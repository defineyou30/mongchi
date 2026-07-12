import { describe, expect, it } from "vitest";

import { getHomeRetentionPromptPresentation } from "./homeRetentionPresentation";

describe("home retention prompt presentation", () => {
  it("starts with a D1 care prompt when today's care is still missing", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 1,
        hasCaredToday: false,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false
      })
    ).toMatchObject({
      milestoneId: "day1",
      eyebrow: "D1",
      ctaLabel: "Care now",
      action: "care",
      progressLabel: "D1 / D1",
      tone: "daily"
    });
  });

  it("moves D3 into the snack rhythm reward prompt", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 3,
        hasCaredToday: false,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false
      })
    ).toMatchObject({
      milestoneId: "day3",
      eyebrow: "D3",
      ctaLabel: "Care today",
      action: "care",
      progressLabel: "D3 / D3",
      tone: "reward"
    });
  });

  it("surfaces the D7 memory track after today's care is done", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 5,
        hasCaredToday: true,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false
      })
    ).toMatchObject({
      milestoneId: "day7",
      eyebrow: "D7",
      title: "One-week memory",
      ctaLabel: "See profile",
      action: "friend",
      progressLabel: "D5 / D7",
      tone: "memory"
    });
  });

  it("localizes the D7 memory prompt for Korean", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "몽치",
        daysTogether: 5,
        hasCaredToday: true,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false,
        locale: "ko-KR"
      })
    ).toMatchObject({
      title: "일주일의 추억",
      line: "일주일의 추억이 가까워졌어요. 추억책이 조금씩 우리 이야기로 채워지고 있어요.",
      ctaLabel: "프로필 보기"
    });
  });

  it("localizes the completed D7 memory prompt for Japanese", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Momo",
        daysTogether: 5,
        hasCaredToday: true,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false,
        locale: "ja-JP"
      })
    ).toMatchObject({
      title: "1週間の思い出",
      line: "1週間の思い出までもう少し。スクラップブックが少しずつふたりらしくなっています。",
      ctaLabel: "プロフィールを見る"
    });
  });

  it("localizes the waiting D30 letter prompt for Mexican Spanish", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Momo",
        daysTogether: 31,
        hasCaredToday: false,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false,
        locale: "es-MX"
      })
    ).toMatchObject({
      title: "Carta del primer mes",
      line: "Momo dejó una carta sobre su primer mes juntos.",
      ctaLabel: "Abrir carta"
    });
  });

  it("keeps D14 as a profile-oriented relationship prompt once care is complete", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 12,
        hasCaredToday: true,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false
      })
    ).toMatchObject({
      milestoneId: "day14",
      eyebrow: "D14",
      title: "Two-week rhythm",
      ctaLabel: "See profile",
      action: "friend",
      progressLabel: "D12 / D14"
    });
  });

  it("prioritizes the unopened monthly letter on D30", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 31,
        hasCaredToday: false,
        hasOpenedMonthlyLetter: false,
        isOnWalk: false
      })
    ).toMatchObject({
      milestoneId: "day30",
      eyebrow: "D30",
      title: "One-month letter",
      ctaLabel: "Open letter",
      action: "friend",
      progressLabel: "D30 / D30",
      tone: "letter"
    });
  });

  it("hides while the pet is on a walk so walk panels own the bottom surface", () => {
    expect(
      getHomeRetentionPromptPresentation({
        petName: "Mong",
        daysTogether: 7,
        hasCaredToday: false,
        hasOpenedMonthlyLetter: false,
        isOnWalk: true
      })
    ).toBeNull();
  });
});
