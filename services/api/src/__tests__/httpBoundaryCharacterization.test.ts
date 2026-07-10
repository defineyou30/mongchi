import { describe, expect, it } from "vitest";

import { createApiHttpRouter } from "../httpRouter";

describe("API HTTP boundary characterization", () => {
  it("Given a valid pet mutation body, when the route handles it, then the existing 201 response is preserved", () => {
    // Given
    const router = createApiHttpRouter();

    // When
    const response = router.handle({
      method: "POST",
      path: "/v1/pets",
      headers: {
        authorization: "Bearer user_demo_001"
      },
      body: {
        name: "Miso",
        species: "dog",
        personalityTags: ["curious"],
        talkingStyle: "gentle"
      }
    });

    // Then
    expect(response).toMatchObject({
      status: 201,
      body: {
        userId: "user_demo_001",
        name: "Miso",
        species: "dog",
        personalityTags: ["curious"],
        talkingStyle: "gentle",
        lifecycleStatus: "draft"
      }
    });
  });
});
