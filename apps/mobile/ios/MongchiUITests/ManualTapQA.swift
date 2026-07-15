import XCTest

final class ManualTapQA: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "app.mongchi.mobile")

  override func setUpWithError() throws {
    continueAfterFailure = false
    app.activate()
    waitForAppToSettle(2.0)
    _ = tapButtonIfPresent(containing: "Close language picker")
  }

  func test00LanguagePickerPersistsAndReturnsToDeviceLanguage() throws {
    let koreanGlobe = app.buttons["앱 언어 선택"]
    XCTAssertTrue(koreanGlobe.waitForExistence(timeout: 15), "The first-screen language button did not appear.")
    koreanGlobe.tap()

    let japaneseOption = app.buttons["日本語"]
    XCTAssertTrue(japaneseOption.waitForExistence(timeout: 5), "The Japanese language option did not appear.")
    japaneseOption.tap()

    let japaneseGlobe = app.buttons["アプリの言語を選択"]
    XCTAssertTrue(japaneseGlobe.waitForExistence(timeout: 5), "The app did not switch to Japanese.")

    app.terminate()
    app.activate()
    XCTAssertTrue(japaneseGlobe.waitForExistence(timeout: 15), "The Japanese override did not survive relaunch.")
    japaneseGlobe.tap()

    let automaticOption = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "自動")).firstMatch
    XCTAssertTrue(automaticOption.waitForExistence(timeout: 5), "The Automatic option did not appear.")
    automaticOption.tap()

    XCTAssertTrue(koreanGlobe.waitForExistence(timeout: 5), "Automatic did not return to the Korean device language.")
    koreanGlobe.tap()

    let selectedAutomatic = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "자동")).firstMatch
    XCTAssertTrue(selectedAutomatic.waitForExistence(timeout: 5), "The selected Automatic option did not appear.")
    XCTAssertTrue(selectedAutomatic.isSelected, "Automatic was not exposed as the selected language preference.")
    capture("language-picker-device-default")
  }

  func test00PetSpeciesSelectionByActualTap() throws {
    let catOption = app.descendants(matching: .any)["고양이"]
    let dogOption = app.descendants(matching: .any)["강아지"]

    XCTAssertTrue(catOption.waitForExistence(timeout: 15), "The Cat species option did not appear on pet setup.")
    XCTAssertTrue(dogOption.exists, "The Dog species option did not appear on pet setup.")

    catOption.tap()
    XCTAssertTrue(waitForSelection(catOption), "The Cat species option did not expose its selected state after tapping.")
    XCTAssertFalse(dogOption.isSelected, "The Dog species option stayed selected after choosing Cat.")
    capture("pet-setup-cat-selected")

    dogOption.tap()
    XCTAssertTrue(waitForSelection(dogOption), "The Dog species option did not become selected again.")
  }

  func test01HomeCareButtonsByActualTap() throws {
    XCTAssertTrue(waitForHome(), "Home screen did not become ready for manual tap QA.")
    capture("00-home-start")

    tapButton(containing: "Feed", fallbackX: 0.13, fallbackY: 0.91)
    waitForAppToSettle(0.7)
    capture("01-home-feed-menu")

    if tapButtonIfPresent(containing: "Daily meal") || tapButtonIfPresent(containing: "Meal") {
      waitForAppToSettle(3.2)
      capture("02-home-after-feed")
    } else {
      waitForAppToSettle(0.6)
      capture("02-home-feed-menu-no-meal-action")
    }

    tapButton(containing: "Water", fallbackX: 0.79, fallbackY: 0.91)
    waitForAppToSettle(3.2)
    capture("03-home-after-water")

    tapButton(containing: "Play", fallbackX: 0.29, fallbackY: 0.91)
    waitForAppToSettle(3.2)
    capture("04-home-after-play")

    tapButton(containing: "Pet", fallbackX: 0.62, fallbackY: 0.91)
    waitForAppToSettle(3.2)
    capture("05-home-after-pet")

    tapButton(containing: "Walk", fallbackX: 0.45, fallbackY: 0.91)
    waitForAppToSettle(3.2)
    capture("06-home-after-walk-start")

    waitForAppToSettle(16.5)
    capture("07-home-after-walk-return")
  }

  func test01WalkEarlyReturnByActualTap() throws {
    let bringHomeButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Spend 1 credit")).firstMatch
    XCTAssertTrue(bringHomeButton.waitForExistence(timeout: 20), "The paid early-return button did not appear for an active walk.")
    capture("08-walk-before-paid-early-return")

    bringHomeButton.tap()

    let claimButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "claim the walk gift")).firstMatch
    XCTAssertTrue(claimButton.waitForExistence(timeout: 5), "The walk did not return immediately after the 1-credit action.")
    capture("09-walk-after-paid-early-return")

    tapButton(containing: "Open shop", fallbackX: 0.09, fallbackY: 0.16)
    let walletButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Shop wallet, 11 credits")).firstMatch
    XCTAssertTrue(walletButton.waitForExistence(timeout: 5), "The early-return action did not reduce the 12-credit wallet to 11.")
    capture("10-shop-after-paid-early-return")
  }

  func test02SideNavigationButtonsByActualTap() throws {
    XCTAssertTrue(waitForHome(), "Home screen did not become ready for side navigation QA.")

    tapButton(containing: "Open shop", fallbackX: 0.09, fallbackY: 0.16)
    waitForAppToSettle(1.3)
    capture("10-shop-opened")

    let careTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Treats & Toys")).firstMatch
    XCTAssertTrue(careTab.waitForExistence(timeout: 5), "The care shop tab did not appear.")
    XCTAssertTrue(careTab.isSelected, "The care shop tab was not selected by default.")

    let customizeTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Poses & Themes")).firstMatch
    XCTAssertTrue(customizeTab.waitForExistence(timeout: 5), "The pose and theme shop tab did not appear.")
    customizeTab.tap()
    waitForAppToSettle(0.8)
    XCTAssertTrue(customizeTab.isSelected, "The pose and theme tab did not expose its selected state after tapping.")
    XCTAssertTrue(app.staticTexts["Pose packs"].waitForExistence(timeout: 5), "The pose pack section did not appear after switching tabs.")
    capture("11-shop-poses-themes-tab")

    let walletButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Shop wallet")).firstMatch
    XCTAssertTrue(walletButton.waitForExistence(timeout: 5), "The separate gem wallet entry did not appear.")
    walletButton.tap()
    waitForAppToSettle(0.8)
    XCTAssertTrue(app.staticTexts["Gem Store"].waitForExistence(timeout: 5), "The wallet entry did not open the gem store.")
    capture("12-gem-store-opened")

    tapButton(containing: "Back to the garden shop", fallbackX: 0.08, fallbackY: 0.09)
    waitForAppToSettle(0.8)
    XCTAssertTrue(careTab.waitForExistence(timeout: 5), "Returning from the wallet did not restore the shop.")
    capture("13-shop-after-wallet-back")

    tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
    waitForAppToSettle(1.0)
    capture("14-home-after-shop-back")

    tapButton(containing: "chat", fallbackX: 0.09, fallbackY: 0.26)
    waitForAppToSettle(1.2)
    capture("20-chat-opened")

    if tapButtonIfPresent(containing: "View Plus pass") {
      waitForAppToSettle(1.0)
      capture("21-chat-plus-to-shop")
      tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
      waitForAppToSettle(1.0)
    } else {
      tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
      waitForAppToSettle(1.0)
    }
    capture("22-home-after-chat-back")

    tapButton(containing: "Open settings", fallbackX: 0.09, fallbackY: 0.36)
    waitForAppToSettle(1.2)
    capture("30-settings-opened")

    if tapButtonIfPresent(containing: "Enable") || tapButtonIfPresent(containing: "Turn off") {
      waitForAppToSettle(0.8)
      capture("31-settings-weather-toggle")
    }

    if tapButtonIfPresent(containing: "Change") {
      waitForAppToSettle(0.8)
      capture("32-settings-weather-change")
      _ = tapButtonIfPresent(containing: "Close language picker")
    }

    tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
    waitForAppToSettle(1.0)
    capture("33-home-after-settings-back")
  }

  func test02ShopCareFiltersByActualTap() throws {
    app.terminate()
    app.launch()
    waitForAppToSettle(2.0)
    XCTAssertTrue(restoreEnglishHome(), "The app could not be normalized to English before care-filter QA.")

    tapButton(containing: "Open shop", fallbackX: 0.09, fallbackY: 0.16)
    let filters = [
      (label: "All, 48 items", capture: "59-shop-filter-all"),
      (label: "Treats, 12 items", capture: "60-shop-filter-treats"),
      (label: "Drinks, 12 items", capture: "61-shop-filter-drinks"),
      (label: "Toys, 12 items", capture: "62-shop-filter-toys"),
      (label: "Rest, 12 items", capture: "63-shop-filter-rest")
    ]

    for filter in filters {
      let button = app.buttons[filter.label]
      XCTAssertTrue(button.waitForExistence(timeout: 5), "The \(filter.label) filter did not expose the expected item count.")
      button.tap()
      waitForAppToSettle(0.8)
      XCTAssertTrue(button.isSelected, "The \(filter.label) filter did not expose its selected state.")
      capture(filter.capture)
    }

    tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
  }

  func test03ShopGetItemButtonByActualTap() throws {
    XCTAssertTrue(waitForHome(), "Home screen did not become ready for shop purchase QA.")

    tapButton(containing: "Open shop", fallbackX: 0.09, fallbackY: 0.16)
    waitForAppToSettle(1.2)
    capture("40-shop-before-get-item")

    if tapButtonIfPresent(containing: "Buy") || tapButtonIfPresent(containing: "Get item") {
      waitForAppToSettle(1.0)
      capture("41-shop-after-get-item")

      if tapButtonIfPresent(containing: "Stay") || tapButtonIfPresent(containing: "OK") {
        waitForAppToSettle(0.8)
        capture("42-shop-after-alert-dismiss")
      }
    } else {
      capture("41-shop-get-item-not-available")
    }

    tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
    waitForAppToSettle(1.0)
    capture("43-home-after-shop-get-item-back")
  }

  func test04ShopLocalizedLayoutsByActualTap() throws {
    app.terminate()
    app.launch()
    waitForAppToSettle(2.0)
    XCTAssertTrue(restoreEnglishHome(), "The app could not be normalized to the English home screen before localized shop QA.")

    let locales = [
      (option: "日本語", backHome: "ホームに戻る", openShop: "ショップを開く", care: "おやつ・おもちゃ", customize: "ポーズ・テーマ", capture: "ja"),
      (option: "繁體中文", backHome: "回到主畫面", openShop: "開啟商店", care: "點心・玩具", customize: "姿勢・主題", capture: "zh"),
      (option: "Deutsch", backHome: "Zurück nach Hause", openShop: "Shop öffnen", care: "Leckerlis & Spielzeug", customize: "Posen & Themen", capture: "de"),
      (option: "Français", backHome: "Retour à l’accueil", openShop: "Ouvrir la boutique", care: "Friandises & jouets", customize: "Poses & thèmes", capture: "fr"),
      (option: "Português (Brasil)", backHome: "Voltar ao início", openShop: "Abrir loja", care: "Petiscos e brinquedos", customize: "Poses e temas", capture: "pt"),
      (option: "Español (México)", backHome: "Volver al inicio", openShop: "Abrir la tienda", care: "Premios y juguetes", customize: "Poses y temas", capture: "es"),
      (option: "한국어", backHome: "홈으로 돌아가기", openShop: "상점 열기", care: "간식·장난감", customize: "포즈·테마", capture: "ko"),
      (option: "English", backHome: "Back home", openShop: "Open shop", care: "Treats & Toys", customize: "Poses & Themes", capture: "en-restored")
    ]

    for locale in locales {
      let settingsButton = visibleButton(matchingAny: localizedSettingsButtonLabels)
      XCTAssertTrue(settingsButton.waitForExistence(timeout: 5), "The settings button did not appear before selecting \(locale.option).")
      settingsButton.tap()

      let changeButton = visibleButton(matchingAny: localizedChangeButtonLabels)
      XCTAssertTrue(changeButton.waitForExistence(timeout: 5), "The language change action did not appear before selecting \(locale.option).")
      changeButton.tap()

      XCTAssertTrue(
        tapLanguageOption(locale.option),
        "The \(locale.option) language option did not appear."
      )
      XCTAssertTrue(waitForLanguagePickerToClose(), "The language picker did not fully close for \(locale.option).")
      waitForAppToSettle(0.5)

      XCTAssertTrue(
        returnToVisibleHome(shopLabel: locale.openShop, backLabels: [locale.backHome]),
        "The localized shop button did not appear for \(locale.option)."
      )
      let shopButton = visibleButton(label: locale.openShop)
      shopButton.tap()
      waitForAppToSettle(0.8)

      let careTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", locale.care)).firstMatch
      XCTAssertTrue(careTab.waitForExistence(timeout: 5), "The care tab did not fit for \(locale.option).")
      capture("50-shop-\(locale.capture)-care")

      let customizeTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", locale.customize)).firstMatch
      XCTAssertTrue(customizeTab.waitForExistence(timeout: 5), "The customize tab did not fit for \(locale.option).")
      customizeTab.tap()
      waitForAppToSettle(0.8)
      capture("51-shop-\(locale.capture)-customize")

      let shopBackButton = visibleButton(label: locale.backHome)
      XCTAssertTrue(shopBackButton.waitForExistence(timeout: 5), "The localized shop back button did not appear for \(locale.option).")
      shopBackButton.tap()
      waitForAppToSettle(1.0)
    }
  }

  private func restoreEnglishHome() -> Bool {
    let englishShopButton = visibleButton(label: "Open shop")
    if englishShopButton.waitForExistence(timeout: 2) {
      return true
    }

    guard returnToVisibleHome(shopLabel: nil, backLabels: localizedBackHomeButtonLabels) else {
      return false
    }

    let settingsButton = visibleButton(matchingAny: localizedSettingsButtonLabels)
    if settingsButton.waitForExistence(timeout: 2) {
      settingsButton.tap()
      waitForAppToSettle(0.8)
    }

    let changeButton = visibleButton(matchingAny: localizedChangeButtonLabels)
    guard changeButton.waitForExistence(timeout: 5) else {
      return false
    }

    changeButton.tap()
    guard tapLanguageOption("English") else {
      return false
    }
    guard waitForLanguagePickerToClose() else {
      return false
    }
    waitForAppToSettle(0.5)

    return returnToVisibleHome(shopLabel: "Open shop", backLabels: ["Back home"])
  }

  private var localizedSettingsButtonLabels: [String] {
    ["Open settings", "設定を開く", "開啟設定", "Einstellungen öffnen", "Ouvrir les réglages", "Abrir ajustes", "Abrir configuración", "설정 열기"]
  }

  private var localizedChangeButtonLabels: [String] {
    ["Change", "変更", "變更", "Ändern", "Modifier", "Alterar", "Cambiar", "변경"]
  }

  private var localizedOpenShopButtonLabels: [String] {
    ["Open shop", "ショップを開く", "開啟商店", "Shop öffnen", "Ouvrir la boutique", "Abrir loja", "Abrir la tienda", "상점 열기"]
  }

  private var localizedBackHomeButtonLabels: [String] {
    ["Back home", "ホームに戻る", "回到主畫面", "Zurück nach Hause", "Retour à l’accueil", "Voltar ao início", "Volver al inicio", "홈으로 돌아가기"]
  }

  private func visibleButton(label: String) -> XCUIElement {
    let query = app.buttons.matching(NSPredicate(format: "label == %@", label))
    return query.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? query.firstMatch
  }

  private func visibleButton(matchingAny labels: [String]) -> XCUIElement {
    let query = app.buttons.matching(NSPredicate(format: "label IN %@", labels))
    return query.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? query.firstMatch
  }

  private func returnToVisibleHome(shopLabel: String?, backLabels: [String]) -> Bool {
    let expectedShopLabels = shopLabel.map { [$0] } ?? localizedOpenShopButtonLabels

    for attempt in 0..<4 {
      if visibleButton(matchingAny: expectedShopLabels).waitForExistence(timeout: attempt == 0 ? 1 : 3) {
        return true
      }

      let backButton = visibleButton(matchingAny: backLabels)
      guard backButton.waitForExistence(timeout: 2) else {
        return false
      }

      backButton.tap()
      waitForAppToSettle(1.0)
    }

    return visibleButton(matchingAny: expectedShopLabels).waitForExistence(timeout: 3)
  }

  private func waitForLanguagePickerToClose() -> Bool {
    let closeLabels = [
      "Close language picker",
      "言語選択を閉じる",
      "關閉語言選擇",
      "Sprachauswahl schließen",
      "Fermer le choix de langue",
      "Fechar seletor de idioma",
      "Cerrar selector de idioma",
      "언어 선택 닫기"
    ]
    let anyCloseButton = app.buttons.matching(NSPredicate(format: "label IN %@", closeLabels)).firstMatch
    return anyCloseButton.waitForNonExistence(timeout: 5)
  }

  private func tapLanguageOption(_ label: String) -> Bool {
    let option = app.buttons[label]
    if option.waitForExistence(timeout: 1), option.isHittable {
      option.tap()
      return true
    }

    for _ in 0..<6 {
      app.swipeDown()
      if option.waitForExistence(timeout: 0.5), option.isHittable {
        option.tap()
        return true
      }
    }

    for _ in 0..<6 {
      app.swipeUp()
      if option.waitForExistence(timeout: 0.5), option.isHittable {
        option.tap()
        return true
      }
    }

    return false
  }

  private func waitForHome() -> Bool {
    let feedButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Feed")).firstMatch
    if feedButton.waitForExistence(timeout: 30) {
      return true
    }

    let startButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Choose pet photo")).firstMatch
    if startButton.exists {
      return false
    }

    return app.images.matching(NSPredicate(format: "label CONTAINS[c] %@", "pet avatar")).firstMatch.exists
  }

  private func waitForSelection(_ element: XCUIElement) -> Bool {
    let selected = NSPredicate(format: "selected == true")
    let expectation = XCTNSPredicateExpectation(predicate: selected, object: element)
    return XCTWaiter.wait(for: [expectation], timeout: 3) == .completed
  }

  @discardableResult
  private func tapButtonIfPresent(containing label: String) -> Bool {
    let button = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
    if button.waitForExistence(timeout: 2) {
      button.tap()
      return true
    }

    return false
  }

  private func tapButton(containing label: String, fallbackX: CGFloat, fallbackY: CGFloat) {
    if tapButtonIfPresent(containing: label) {
      return
    }

    app.coordinate(withNormalizedOffset: CGVector(dx: fallbackX, dy: fallbackY)).tap()
  }

  private func capture(_ name: String) {
    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func waitForAppToSettle(_ seconds: TimeInterval) {
    RunLoop.current.run(until: Date().addingTimeInterval(seconds))
  }
}
