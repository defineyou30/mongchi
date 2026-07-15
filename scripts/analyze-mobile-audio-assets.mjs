import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const provenancePath = resolve(repositoryRoot, "docs/release/legal/audio-asset-provenance.json");
const argumentsSet = new Set(process.argv.slice(2));
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;

if (!outputPath) {
  throw new Error("Missing required --output <path>.");
}

const run = (command, argumentsList) => {
  const result = spawnSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} exited with ${result.status}.`);
  }

  return `${result.stdout}${result.stderr}`;
};

const parseProbe = (filePath) => {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,sample_rate,channels",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  const probe = JSON.parse(output);
  const stream = probe.streams?.find((candidate) => candidate.codec_type === "audio");

  if (!stream || !probe.format) {
    throw new Error("ffprobe did not return a primary audio stream.");
  }

  return {
    codecName: stream.codec_name,
    sampleRateHz: Number(stream.sample_rate),
    channels: Number(stream.channels),
    durationSeconds: Number(probe.format.duration)
  };
};

const parseLoudness = (filePath) => {
  try {
    const output = run("ffmpeg", ["-hide_banner", "-nostats", "-i", filePath, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]);
    const integratedLufs = output.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/s)?.[1];
    const truePeakDbfs = output.match(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/s)?.[1];

    return {
      integratedLufs: integratedLufs ? Number(integratedLufs) : null,
      truePeakDbfs: truePeakDbfs ? Number(truePeakDbfs) : null
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown ffmpeg error.";
    return { integratedLufs: null, truePeakDbfs: null, analysisError: detail };
  }
};

const readLoopSeamJump = (filePath) => {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", filePath, "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"],
    { cwd: repositoryRoot, encoding: null, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 }
  );

  if (result.error || result.status !== 0 || !result.stdout || result.stdout.length < 8) {
    return null;
  }

  const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, Math.floor(result.stdout.length / 4));
  return Math.abs(samples[0] - samples[samples.length - 1]);
};

const targetForRole = (role) => {
  if (role === "bgm") {
    return { minimumDurationSeconds: 60, maximumDurationSeconds: 90, targetIntegratedLufs: -23 };
  }

  if (role === "ambience") {
    return { minimumDurationSeconds: 45, maximumDurationSeconds: 90, targetIntegratedLufs: -28 };
  }

  if (role === "sfx") {
    return { maximumDurationSeconds: 3 };
  }

  return { maximumDurationSeconds: 5 };
};

const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const files = provenance.files.map((entry) => {
  const absolutePath = resolve(repositoryRoot, entry.path);
  const absoluteLicenseSnapshotPath = resolve(repositoryRoot, entry.licenseSnapshotPath);
  const target = targetForRole(entry.role);

  if (!existsSync(absolutePath)) {
    return { ...entry, analysis: null, qualityFailures: ["Asset file is missing."] };
  }

  const probe = parseProbe(absolutePath);
  const loudness = parseLoudness(absolutePath);
  const qualityFailures = [];

  if (!existsSync(absoluteLicenseSnapshotPath)) {
    qualityFailures.push("License snapshot is missing.");
  }

  if (probe.sampleRateHz !== 48000) {
    qualityFailures.push(`Expected 48000 Hz but measured ${probe.sampleRateHz} Hz.`);
  }

  if (probe.codecName !== "aac") {
    qualityFailures.push(`Expected AAC audio but measured ${probe.codecName ?? "unknown"}.`);
  }

  if (probe.channels !== 2) {
    qualityFailures.push(`Expected stereo (2 channels) but measured ${probe.channels} channels.`);
  }

  if ("minimumDurationSeconds" in target && probe.durationSeconds < target.minimumDurationSeconds) {
    qualityFailures.push(`Duration ${probe.durationSeconds.toFixed(3)}s is below ${target.minimumDurationSeconds}s.`);
  }

  if ("maximumDurationSeconds" in target && probe.durationSeconds > target.maximumDurationSeconds) {
    qualityFailures.push(`Duration ${probe.durationSeconds.toFixed(3)}s exceeds ${target.maximumDurationSeconds}s.`);
  }

  if ("targetIntegratedLufs" in target && loudness.integratedLufs !== null && Math.abs(loudness.integratedLufs - target.targetIntegratedLufs) > 1) {
    qualityFailures.push(`Integrated loudness ${loudness.integratedLufs} LUFS misses ${target.targetIntegratedLufs} LUFS target by more than 1 LU.`);
  }

  if (loudness.truePeakDbfs !== null && loudness.truePeakDbfs > -1) {
    qualityFailures.push(`True peak ${loudness.truePeakDbfs} dBFS exceeds -1 dBTP ceiling.`);
  }

  const loopSeamJump = entry.loopSource ? readLoopSeamJump(absolutePath) : null;

  if (entry.loopSource && loopSeamJump === null) {
    qualityFailures.push("Could not decode the loop seam for verification.");
  }

  if (loopSeamJump !== null && loopSeamJump > 0.25) {
    qualityFailures.push(`Loop seam sample jump ${loopSeamJump.toFixed(6)} exceeds 0.25.`);
  }

  return {
    ...entry,
    analysis: {
      sha256: createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
      licenseSnapshotSha256: existsSync(absoluteLicenseSnapshotPath)
        ? createHash("sha256").update(readFileSync(absoluteLicenseSnapshotPath)).digest("hex")
        : null,
      ...probe,
      ...loudness,
      loopSeamJump,
      ffprobeCommand: "ffprobe -v error -show_entries stream=codec_type,codec_name,sample_rate,channels -show_entries format=duration -of json",
      ffmpegCommand: "ffmpeg -hide_banner -nostats -filter_complex ebur128=peak=true -f null -"
    },
    qualityFailures
  };
});

const canShipFinalAudio =
  provenance.requiredButMissing.length === 0 &&
  files.every(
    (entry) =>
      entry.releaseStatus === "licensed_ready" &&
      entry.sourceUrl &&
      entry.creator &&
      entry.license === "CC0-1.0" &&
      entry.licenseSnapshotPath &&
      entry.analysis &&
      entry.qualityFailures.length === 0
  );

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  releaseStatus: provenance.releaseStatus,
  files,
  requiredButMissing: provenance.requiredButMissing,
  canShipFinalAudio
};
const absoluteOutputPath = resolve(repositoryRoot, outputPath);
mkdirSync(dirname(absoluteOutputPath), { recursive: true });
writeFileSync(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, releaseStatus: report.releaseStatus, canShipFinalAudio: report.canShipFinalAudio }));

if (!canShipFinalAudio && !argumentsSet.has("--allow-blocked")) {
  process.exitCode = 1;
}
