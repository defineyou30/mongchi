import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
import Svg, { Circle, Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import type { GeneratedAssetId } from "@mongchi/shared";
import type { AppLocale } from "../../localization/localeNormalization";

import { getGeneratedPetAssetSource } from "../assets/generatedPetAssets";
import { colors, useFontFamilies } from "../design/tokens";
import { buildBrandedPetShareCardCopy } from "./brandedPetShareCard";
import { captureBrandedPetShareCard } from "./captureBrandedPetShareCard";

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
}

export const BRANDED_SHARE_CARD_SIZE = {
  width: 360,
  height: 450
} as const;

const exportViewBox = "0 0 1080 1350";

export const BrandedPetShareCard = forwardRef<BrandedPetShareCardHandle, BrandedPetShareCardProps>(
  ({ assetId, daysTogether, petName, petAssetUri, publicUrl, style, locale = "en-US" }, ref) => {
    const fontFamilies = useFontFamilies();
    const svgRef = useRef<Svg>(null);
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

      return captureBrandedPetShareCard(svgRef.current);
    }, []);

    useImperativeHandle(ref, () => ({ capture }), [capture]);
    const petNameFontSize = copy.petName.length > 18 ? 52 : copy.petName.length > 12 ? 64 : 86;

    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[BRANDED_SHARE_CARD_SIZE, style]}
      >
        <Svg ref={svgRef} height="100%" viewBox={exportViewBox} width="100%">
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
            onLoad={() => {
              imageReadyRef.current = true;
              imageReadyResolverRef.current?.(true);
            }}
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
        </Svg>
      </View>
    );
  }
);

BrandedPetShareCard.displayName = "BrandedPetShareCard";
