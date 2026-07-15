import { describe, expect, it } from "vitest";

import { buildBrandedPetShareCardCopy } from "./brandedPetShareCard";

describe("buildBrandedPetShareCardCopy", () => {
  it("builds a warm, branded dayless card without inventing a link", () => {
    expect(buildBrandedPetShareCardCopy({ petName: " Miso " })).toEqual({
      petName: "Miso",
      heading: "MY TINY GARDEN FRIEND",
      warmLine: "A tiny friend, always close.",
      attribution: "Made with Mongchi",
      publicUrl: null,
      wordmark: "Mongchi",
      tagline: "Your pet's cozy little garden"
    });
  });

  it("builds a fully Korean branded card while preserving the pet name", () => {
    expect(buildBrandedPetShareCardCopy({ petName: "Miso", daysTogether: 12, locale: "ko-KR" })).toMatchObject({
      petName: "Miso",
      heading: "나의 작은 정원 친구",
      warmLine: "작은 정원에서 함께한 지 12일.",
      attribution: "Mongchi에서 만들었어요"
    });
  });

  it("builds Japanese and German branded cards without English fallback copy", () => {
    expect(buildBrandedPetShareCardCopy({ petName: "Miso", daysTogether: 12, locale: "ja-JP" })).toMatchObject({
      petName: "Miso",
      heading: "小さな庭のお友だち",
      warmLine: "小さな庭で一緒に過ごして12日。",
      attribution: "Mongchiで作りました"
    });
    expect(buildBrandedPetShareCardCopy({ petName: "Miso", locale: "de-DE" })).toMatchObject({
      heading: "MEIN KLEINER GARTENFREUND",
      warmLine: "Ein kleiner Freund, immer ganz nah.",
      attribution: "Erstellt mit Mongchi"
    });
  });

  it("uses relationship time when it is available", () => {
    expect(buildBrandedPetShareCardCopy({ petName: "Luna", daysTogether: 12 }).warmLine).toBe(
      "12 days of tiny garden moments."
    );
  });

  it("only retains a valid configured public URL", () => {
    expect(
      buildBrandedPetShareCardCopy({ petName: "Miso", publicUrl: "https://mongchi.app" }).publicUrl
    ).toBe("https://mongchi.app");
    expect(
      buildBrandedPetShareCardCopy({ petName: "Miso", publicUrl: "https://example.com/app" }).publicUrl
    ).toBeNull();
  });

  it("keeps the wordmark untranslated but localizes the poster footer's tagline", () => {
    expect(buildBrandedPetShareCardCopy({ petName: "Miso", locale: "ja-JP" })).toMatchObject({
      wordmark: "Mongchi",
      tagline: "うちの子の、居心地いい小さな庭"
    });
    expect(buildBrandedPetShareCardCopy({ petName: "Miso", locale: "ko-KR" })).toMatchObject({
      wordmark: "Mongchi",
      tagline: "우리 반려동물의 아늑한 작은 정원"
    });
  });
});
