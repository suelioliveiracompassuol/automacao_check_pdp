import fs from "node:fs";
import path from "node:path";
import type { SkuConfig } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

/** Login screen sets FLAG_SECURE (screenshots fail), so the UI hierarchy is the only way to see what's on screen. */
async function dumpLoginDiagnostics(
  driver: WebdriverIO.Browser,
): Promise<void> {
  try {
    const [activity, source] = await Promise.all([
      driver.getCurrentActivity().catch(() => "?"),
      driver.getPageSource(),
    ]);
    const dir = path.join(process.cwd(), ".tmp", "artifacts", "auth");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `login_source_${Date.now()}.xml`);
    fs.writeFileSync(file, source);
    const ids = [
      ...new Set(
        [...source.matchAll(/resource-id="([^"]+)"/g)].map((m) => m[1]),
      ),
    ];
    console.log(`      🔎 Activity: ${activity}`);
    console.log(
      `      🔎 resource-ids na tela (${ids.length}): ${ids.slice(0, 40).join(", ")}`,
    );
    console.log(`      🔎 Hierarquia salva em ${file}`);
  } catch {
    // diagnostics are best-effort
  }
}

/**
 * Native login flow for the Android app, ported from ncf-natura-cf-automation-mobile's
 * login.screen.js / permissionAlerts.js (Account tab -> email/password fields -> "entrar").
 * Must run on a PLAIN app launch (driver.activateApp), before any openPdpDeepLink +
 * terminateApp cycle — the session is persisted on device (secure storage), so it survives
 * the process being killed and relaunched via deep link afterwards.
 */
export interface AndroidCredentials {
  email: string;
  password: string;
}

/**
 * Env var names with the test account of an operation. Accounts are per brand and country:
 * Natura BR keeps the original ANDROID_LOGIN_EMAIL/ANDROID_LOGIN_PASSWORD; every other
 * operation has its own, e.g. ANDROID_LOGIN_EMAIL_NATURA_AR / ANDROID_LOGIN_PASSWORD_AVON_MX.
 */
export function androidCredentialEnvNames(
  operation: Pick<SkuConfig, "vendor" | "country">,
): { email: string; password: string } {
  if (operation.vendor === "natura" && operation.country === "BR") {
    return { email: "ANDROID_LOGIN_EMAIL", password: "ANDROID_LOGIN_PASSWORD" };
  }
  const suffix = `${operation.vendor}_${operation.country}`.toUpperCase();
  return {
    email: `ANDROID_LOGIN_EMAIL_${suffix}`,
    password: `ANDROID_LOGIN_PASSWORD_${suffix}`,
  };
}

/**
 * Test account for the operation (see androidCredentialEnvNames). Returns null when either
 * value is unset: the session then runs anonymously — another country's account is never used,
 * since it doesn't exist in that country's store.
 */
export function getAndroidCredentialsFromEnv(
  operation: Pick<SkuConfig, "vendor" | "country">,
): AndroidCredentials | null {
  const names = androidCredentialEnvNames(operation);
  const email = process.env[names.email];
  const password = process.env[names.password];
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

/** Dismisses the Android runtime permission dialog if one is shown after launch. */
async function dismissPermissionDialogIfPresent(
  driver: WebdriverIO.Browser,
): Promise<void> {
  const allowButton = driver.$(
    `android=${ANDROID_SELECTORS.login.permissionAllowButton}`,
  );
  const displayed = await allowButton
    .waitForDisplayed({ timeout: 3000 })
    .catch(() => false);
  if (displayed) {
    await allowButton.click().catch(() => {});
  }
}

/** Waits for either login form; when the Compose Login V2 is shown, taps "entrar usando minha senha" to reach the legacy form. */
async function switchToLegacyLoginIfV2(
  driver: WebdriverIO.Browser,
): Promise<void> {
  const legacyEmail = driver.$(
    `android=${ANDROID_SELECTORS.login.emailContainer}`,
  );
  const v2Email = driver.$(`android=${ANDROID_SELECTORS.login.v2EmailField}`);

  await driver.waitUntil(
    async () =>
      (await legacyEmail.isDisplayed().catch(() => false)) ||
      (await v2Email.isDisplayed().catch(() => false)),
    {
      timeout: 15000,
      timeoutMsg: "nenhuma tela de login apareceu na aba Conta",
    },
  );

  if (await legacyEmail.isDisplayed().catch(() => false)) {
    return;
  }

  const buttons = await driver
    .$$(`android=${ANDROID_SELECTORS.login.v2Buttons}`)
    .getElements();
  if (buttons.length === 0) {
    throw new Error("Login V2 sem botões para alternar ao login com senha");
  }
  await buttons[buttons.length - 1].click();
  console.log("      ✓ Login V2 detectado, alternando para login com senha");
}

/**
 * Logs into the app via the Account tab. Returns true once the login form (email/password
 * fields) is confirmed GONE after re-opening the Account tab, false otherwise — callers
 * should treat a false result as "continue as anonymous session" rather than a hard failure.
 */
export async function loginAndroid(
  driver: WebdriverIO.Browser,
  credentials: AndroidCredentials,
): Promise<boolean> {
  try {
    await dismissPermissionDialogIfPresent(driver);

    const accountTab = driver.$(
      `android=${ANDROID_SELECTORS.login.accountTab}`,
    );
    await accountTab.waitForDisplayed({ timeout: 8000 });
    await accountTab.click();
    console.log("      ✓ Aba Conta aberta");

    await switchToLegacyLoginIfV2(driver);

    const emailClickable = driver.$(
      `android=${ANDROID_SELECTORS.login.emailContainer}`,
    );
    await emailClickable.waitForDisplayed({ timeout: 15000 });
    await emailClickable.click();
    console.log("      ✓ Campo de e-mail aberto");

    const emailField = driver.$(
      `android=${ANDROID_SELECTORS.login.emailInput}`,
    );
    await emailField.waitForDisplayed({ timeout: 5000 });
    await emailField.setValue(credentials.email);
    console.log("      ✓ E-mail preenchido");

    const passwordClickable = driver.$(
      `android=${ANDROID_SELECTORS.login.passwordContainer}`,
    );
    await passwordClickable.waitForDisplayed({ timeout: 5000 });
    await passwordClickable.click();

    const passwordField = driver.$(
      `android=${ANDROID_SELECTORS.login.passwordInput}`,
    );
    await passwordField.waitForDisplayed({ timeout: 5000 });
    await passwordField.setValue(credentials.password);
    console.log("      ✓ Senha preenchida");

    const loginButton = driver.$(
      `android=${ANDROID_SELECTORS.login.loginButton}`,
    );
    await loginButton.waitForDisplayed({ timeout: 5000 });
    await loginButton.click();
    console.log("      ✓ Botão entrar clicado, aguardando confirmação...");

    // Wait dynamically for login button/modal dismissal instead of hardcoded pause
    await loginButton
      .waitForDisplayed({ timeout: 8000, reverse: true })
      .catch(() => {});

    // Login renders as a modal over Home; re-open Account and check whether the login
    // form is gone.
    await accountTab.click().catch(() => {});
    const loginFormStillVisible = await emailClickable
      .isDisplayed()
      .catch(() => false);

    return !loginFormStillVisible;
  } catch (e) {
    console.log(
      `      ❌ Login falhou em: ${e instanceof Error ? e.message : String(e)}`,
    );
    await dumpLoginDiagnostics(driver);
    return false;
  }
}
