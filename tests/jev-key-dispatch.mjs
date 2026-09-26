import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const testUsername = "operator_test";
const testPassword = "secure_password_123";
const defaultExpectedKey = "apikey_2219dfe1cc31878e4468b51134625a75ccfc_08c4884226b30cee70645aa18d2e4f680bfeb69badf98b374131ea8814bc4df8";

const envDefault = {
  WORKER_USERNAME: testUsername,
  WORKER_PASSWORD: testPassword,
};

const validToken = btoa(JSON.stringify({
  user: testUsername,
  timestamp: Date.now(),
  role: "greenoil-operator"
}));

const expiredToken = btoa(JSON.stringify({
  user: testUsername,
  timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago (> 7 days)
  role: "greenoil-operator"
}));

const wrongUserToken = btoa(JSON.stringify({
  user: "some_other_user",
  timestamp: Date.now(),
  role: "greenoil-operator"
}));

async function runTests() {
  console.log("Running JEV Key dispatch tests...");

  // Test 1: No auth -> 401
  {
    const res = await worker.fetch(new Request("https://example.test/api/jev/key", { method: "GET" }), envDefault);
    assert.equal(res.status, 401, "Expected 401 Unauthorized for request without auth");
    const data = await res.json();
    assert.equal(data.error, "Unauthorized");
    console.log("✓ Test 1 passed: Unauthenticated request rejected with 401");
  }

  // Test 2: Invalid/Expired/Wrong user token -> 401
  {
    const resExpired = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": `Bearer ${expiredToken}` }
    }), envDefault);
    assert.equal(resExpired.status, 401, "Expected 401 for expired token");

    const resWrong = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": `Bearer ${wrongUserToken}` }
    }), envDefault);
    assert.equal(resWrong.status, 401, "Expected 401 for wrong user token");

    const resMalformed = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": "Bearer not-a-valid-base64" }
    }), envDefault);
    assert.equal(resMalformed.status, 401, "Expected 401 for malformed token");

    console.log("✓ Test 2 passed: Invalid/expired tokens rejected with 401");
  }

  // Test 3: Authenticated via Authorization Bearer token -> 200 with default key
  {
    const res = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": `Bearer ${validToken}` }
    }), envDefault);
    assert.equal(res.status, 200, "Expected 200 OK for valid Bearer token");
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.apiKey, defaultExpectedKey);
    assert.equal(data.key, defaultExpectedKey);
    assert.equal(data.jevKey, defaultExpectedKey);
    console.log("✓ Test 3 passed: Valid Bearer token receives JEV key");
  }

  // Test 4: Authenticated via Cookie -> 200 with default key
  {
    const res = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Cookie": `greenoil_session=${validToken}` }
    }), envDefault);
    assert.equal(res.status, 200, "Expected 200 OK for valid Cookie");
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.apiKey, defaultExpectedKey);
    console.log("✓ Test 4 passed: Valid Cookie session receives JEV key");
  }

  // Test 5: Custom Secret injected via env.JEV_API_KEY
  {
    const customSecretKey = "apikey_custom_secret_123456789";
    const envWithSecret = {
      ...envDefault,
      JEV_API_KEY: customSecretKey
    };
    const res = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": `Bearer ${validToken}` }
    }), envWithSecret);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.apiKey, customSecretKey);
    console.log("✓ Test 5 passed: Secret configured in Cloudflare environment takes precedence");
  }

  // Test 6: Alias route /api/jev-key and POST method
  {
    const resAlias = await worker.fetch(new Request("https://example.test/api/jev-key", {
      method: "POST",
      headers: { "Authorization": `Bearer ${validToken}` }
    }), envDefault);
    assert.equal(resAlias.status, 200);
    const data = await resAlias.json();
    assert.equal(data.apiKey, defaultExpectedKey);
    console.log("✓ Test 6 passed: Alias /api/jev-key and POST method supported");
  }

  // Test 7: Full login flow then fetch key
  {
    const loginRes = await worker.fetch(new Request("https://example.test/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: testUsername, password: testPassword })
    }), envDefault);
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert(loginData.token, "Login must return token");

    const keyRes = await worker.fetch(new Request("https://example.test/api/jev/key", {
      method: "GET",
      headers: { "Authorization": `Bearer ${loginData.token}` }
    }), envDefault);
    assert.equal(keyRes.status, 200);
    const keyData = await keyRes.json();
    assert.equal(keyData.apiKey, defaultExpectedKey);
    console.log("✓ Test 7 passed: End-to-end login -> dispatch key successful");
  }

  console.log("All JEV Key tests passed!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
