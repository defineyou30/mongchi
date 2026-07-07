import XCTest

final class ManualTapQA: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "app.mongchi.mobile")

  override func setUpWithError() throws {
    continueAfterFailure = false
    app.activate()
    waitForAppToSettle(2.0)
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

  func test02SideNavigationButtonsByActualTap() throws {
    XCTAssertTrue(waitForHome(), "Home screen did not become ready for side navigation QA.")

    tapButton(containing: "Open shop", fallbackX: 0.09, fallbackY: 0.16)
    waitForAppToSettle(1.3)
    capture("10-shop-opened")

    tapButton(containing: "Themes", fallbackX: 0.42, fallbackY: 0.61)
    waitForAppToSettle(0.8)
    capture("11-shop-themes-tab")

    tapButton(containing: "Plants", fallbackX: 0.62, fallbackY: 0.61)
    waitForAppToSettle(0.8)
    capture("12-shop-plants-tab")

    tapButton(containing: "Inventory", fallbackX: 0.82, fallbackY: 0.61)
    waitForAppToSettle(0.8)
    capture("13-shop-inventory-tab")

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
    }

    tapButton(containing: "Back home", fallbackX: 0.08, fallbackY: 0.09)
    waitForAppToSettle(1.0)
    capture("33-home-after-settings-back")
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
