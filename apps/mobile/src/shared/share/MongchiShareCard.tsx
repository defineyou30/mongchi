import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText
} from "react-native-svg";

import { DEFAULT_THEME_ID } from "@mongchi/shared";
import type { GeneratedAssetId, ItemId } from "@mongchi/shared";
import type { AppLocale } from "../../localization/localeNormalization";

import { getGeneratedPetAssetSource } from "../assets/generatedPetAssets";
import { themeBackgroundSourceById } from "../assets/weatherSceneAssets";
import { colors, useFontFamilies } from "../design/tokens";
import { buildBrandedPetShareCardCopy } from "./brandedPetShareCard";
import { captureBrandedPetShareCard, shareCardExportHeight, shareCardExportWidth } from "./captureBrandedPetShareCard";
import { getShareCardCaptureHostStyle } from "./shareCardCaptureHost";

const appIconSource = require("../../../assets/icon.png");

export interface BrandedPetShareCardHandle {
  readonly capture: () => Promise<string | null>;
}

interface BrandedPetShareCardProps {
  readonly assetId: GeneratedAssetId;
  readonly daysTogether?: number | null;
  readonly petName: string;
  readonly petAssetUri?: string | null;
  readonly publicUrl?: string | null;
  readonly style?: ViewStyle;
  readonly locale?: AppLocale;
  /**
   * Present only for the friend page's customizable marketing card (see
   * ShareCardCustomizeSheet): switches to the full-bleed "poster" layout --
   * the owned theme's actual garden art behind the pet instead of the
   * classic drawn-gradient card below, with the brand footer as a small
   * signature rather than the old bottom attribution line. Omitted by
   * PetRevealScreen's first-reveal share, which keeps the classic layout.
   */
  readonly backgroundThemeId?: ItemId | null;
}

export const BRANDED_SHARE_CARD_SIZE = {
  width: 360,
  height: 450
} as const;

const exportViewBox = `0 0 ${shareCardExportWidth} ${shareCardExportHeight}`;
const posterIconSize = 64;

// Always mounted at the literal export size (never the caller's on-screen
// `style`) -- see shareCardCaptureHost.ts for why this must stay decoupled
// from the visible preview's size.
const captureHostStyle = getShareCardCaptureHostStyle({ width: shareCardExportWidth, height: shareCardExportHeight });

export const BrandedPetShareCard = forwardRef<BrandedPetShareCardHandle, BrandedPetShareCardProps>(
  ({ assetId, daysTogether, petName, petAssetUri, publicUrl, style, locale = "en-US", backgroundThemeId }, ref) => {
    const fontFamilies = useFontFamilies();
    const captureSvgRef = useRef<Svg>(null);
    const imageReadyRef = useRef(false);
    const imageReadyResolverRef = useRef<((ready: boolean) => void) | null>(null);
    const copy = buildBrandedPetShareCardCopy({
      petName,
      daysTogether: daysTogether ?? null,
      publicUrl: publicUrl ?? null,
      locale
    });

    const capture = useCallback(async (): Promise<string | null> => {
      if (!imageReadyRef.current) {
        const imageBecameReady = await new Promise<boolean>((resolve) => {
          const timeoutId = setTimeout(() => resolve(false), 1500);
          imageReadyResolverRef.current = (ready) => {
            clearTimeout(timeoutId);
            resolve(ready);
          };
        });

        imageReadyResolverRef.current = null;

        if (!imageBecameReady) {
          return null;
        }
      }

      // Captures the hidden, full-resolution host below -- not the visible
      // preview -- so the exported PNG always matches shareCardExportWidth
      // x shareCardExportHeight instead of whatever small on-screen size the
      // caller is displaying the card at.
      return captureBrandedPetShareCard(captureSvgRef.current);
    }, []);

    useImperativeHandle(ref, () => ({ capture }), [capture]);
    const petNameFontSize = copy.petName.length > 18 ? 52 : copy.petName.length > 12 ? 64 : 86;
    const posterPetNameFontSize = copy.petName.length > 18 ? 60 : copy.petName.length > 12 ? 74 : 96;
    const handlePetImageLoad = () => {
      imageReadyRef.current = true;
      imageReadyResolverRef.current?.(true);
    };

    // The card artwork itself -- identical for the small on-screen preview
    // and the hidden full-resolution capture host below, since both share
    // the same 0 0 1080 1350 viewBox coordinate space and only differ in
    // their SvgView's own on-screen layout size. Only the capture host's
    // image load should gate capture() (see onPetImageLoad), since that's
    // the instance toDataURL actually reads from.
    const renderCardContent = (onPetImageLoad: () => void) =>
      backgroundThemeId ? (
        <>
          {/* Poster layout: the owned theme's real garden art full-bleed
              behind the pet -- see ShareCardCustomizeSheet. Top/bottom
              scrims keep the name and brand signature legible over any
              theme's art without needing per-theme color tuning. */}
          <Defs>
            <LinearGradient id="posterTopScrim" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.overlay} />
              <Stop offset="1" stopColor={colors.overlay} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="posterBottomScrim" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.overlay} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.overlay} />
            </LinearGradient>
            <ClipPath id="posterIconClip">
              <Rect height={posterIconSize} rx={16} width={posterIconSize} x={540 - posterIconSize / 2} y="1164" />
            </ClipPath>
          </Defs>

          <SvgImage
            height="1350"
            href={themeBackgroundSourceById[backgroundThemeId] ?? themeBackgroundSourceById[DEFAULT_THEME_ID]}
            preserveAspectRatio="xMidYMid slice"
            width="1080"
            x="0"
            y="0"
          />
          <Rect fill="url(#posterTopScrim)" height="300" width="1080" x="0" y="0" />
          <Rect fill="url(#posterBottomScrim)" height="330" width="1080" x="0" y="1020" />

          <SvgText
            fill={colors.white}
            fontFamily={fontFamilies.display}
            fontSize={posterPetNameFontSize}
            fontWeight="900"
            textAnchor="middle"
            x="540"
            y="150"
          >
            {copy.petName}
          </SvgText>
          <SvgText
            fill="rgba(255,255,255,0.9)"
            fontFamily={fontFamilies.body}
            fontSize="34"
            fontWeight="800"
            textAnchor="middle"
            x="540"
            y="204"
          >
            {copy.warmLine}
          </SvgText>

          <SvgImage
            height="700"
            href={getGeneratedPetAssetSource(assetId, petAssetUri)}
            onLoad={onPetImageLoad}
            preserveAspectRatio="xMidYMid meet"
            width="700"
            x="190"
            y="470"
          />

          <Rect
            clipPath="url(#posterIconClip)"
            fill={colors.cream}
            height={posterIconSize}
            width={posterIconSize}
            x={540 - posterIconSize / 2}
            y="1164"
          />
          <SvgImage
            clipPath="url(#posterIconClip)"
            height={posterIconSize}
            href={appIconSource}
            width={posterIconSize}
            x={540 - posterIconSize / 2}
            y="1164"
          />
          <SvgText
            fill={colors.white}
            fontFamily={fontFamilies.label}
            fontSize="38"
            fontWeight="900"
            textAnchor="middle"
            x="540"
            y="1276"
          >
            {copy.wordmark}
          </SvgText>
          <SvgText
            fill="rgba(255,255,255,0.82)"
            fontFamily={fontFamilies.body}
            fontSize="24"
            fontWeight="700"
            textAnchor="middle"
            x="540"
            y="1310"
          >
            {copy.tagline}
          </SvgText>
        </>
      ) : (
        <>
          <Defs>
            <LinearGradient id="gardenSky" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.skySoft} />
              <Stop offset="0.58" stopColor={colors.cream} />
              <Stop offset="1" stopColor={colors.parchmentDeep} />
            </LinearGradient>
            <LinearGradient id="gardenGrass" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.leaf} />
              <Stop offset="1" stopColor={colors.moss} />
            </LinearGradient>
          </Defs>

          <Rect fill="url(#gardenSky)" height="1350" width="1080" />
          <Circle cx="874" cy="190" fill={colors.honey} opacity="0.52" r="116" />
          <Path d="M0 710 C180 600 330 650 515 735 C720 830 880 690 1080 620 V1350 H0 Z" fill="url(#gardenGrass)" />
          <Path d="M0 812 C210 742 380 830 548 880 C725 934 890 810 1080 780 V1350 H0 Z" fill={colors.moss} opacity="0.72" />

          <Rect
            fill={colors.cream}
            height="1254"
            opacity="0.94"
            rx="72"
            stroke={colors.parchmentDeep}
            strokeWidth="12"
            width="984"
            x="48"
            y="48"
          />
          <SvgText
            fill={colors.wood}
            fontFamily={fontFamilies.label}
            fontSize="42"
            fontWeight="900"
            letterSpacing="5"
            textAnchor="middle"
            x="540"
            y="154"
          >
            {copy.heading}
          </SvgText>

          <Circle cx="540" cy="572" fill={colors.parchment} opacity="0.92" r="352" />
          <Circle cx="540" cy="572" fill="none" r="352" stroke={colors.cream} strokeWidth="18" />
          <SvgImage
            height="670"
            href={getGeneratedPetAssetSource(assetId, petAssetUri)}
            onLoad={onPetImageLoad}
            preserveAspectRatio="xMidYMid meet"
            width="670"
            x="205"
            y="238"
          />

          <Rect fill={colors.parchment} height="244" rx="52" stroke={colors.cream} strokeWidth="14" width="870" x="105" y="868" />
          <SvgText
            fill={colors.ink}
            fontFamily={fontFamilies.display}
            fontSize={petNameFontSize}
            fontWeight="900"
            textAnchor="middle"
            x="540"
            y="978"
          >
            {copy.petName}
          </SvgText>
          <SvgText
            fill={colors.mutedInk}
            fontFamily={fontFamilies.body}
            fontSize="42"
            fontWeight="800"
            textAnchor="middle"
            x="540"
            y="1054"
          >
            {copy.warmLine}
          </SvgText>

          <SvgText
            fill={colors.woodDark}
            fontFamily={fontFamilies.label}
            fontSize="44"
            fontWeight="900"
            textAnchor="middle"
            x="540"
            y={copy.publicUrl ? "1198" : "1228"}
          >
            {copy.attribution}
          </SvgText>
          {copy.publicUrl ? (
            <SvgText
              fill={colors.skyDeep}
              fontFamily={fontFamilies.body}
              fontSize="32"
              fontWeight="800"
              textAnchor="middle"
              x="540"
              y="1250"
            >
              {copy.publicUrl}
            </SvgText>
          ) : null}
        </>
      );

    return (
      <>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[BRANDED_SHARE_CARD_SIZE, style]}
        >
          <Svg height="100%" viewBox={exportViewBox} width="100%">
            {renderCardContent(() => {})}
          </Svg>
        </View>

        {/*
          Hidden capture-only host: always laid out at the literal export
          size (shareCardExportWidth x shareCardExportHeight), regardless of
          what size the visible preview above is displayed at. See
          shareCardCaptureHost.ts for why this is necessary -- capturing the
          small on-screen preview instead produced a large, mostly blank PNG
          with the card content crammed into its top-left corner.
        */}
        <View
          accessibilityElementsHidden
          collapsable={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={captureHostStyle}
        >
          <Svg ref={captureSvgRef} height={shareCardExportHeight} viewBox={exportViewBox} width={shareCardExportWidth}>
            {renderCardContent(handlePetImageLoad)}
          </Svg>
        </View>
      </>
    );
  }
);

BrandedPetShareCard.displayName = "BrandedPetShareCard";
