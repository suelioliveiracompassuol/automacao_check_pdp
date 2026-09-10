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

/** Reads ANDROID_LOGIN_EMAIL/ANDROID_LOGIN_PASSWORD — returns null when either is unset (login skipped). */
export function getAndroidCredentialsFromEnv(): AndroidCredentials | null {
  const email = process.env.ANDROID_LOGIN_EMAIL;
  const password = process.env.ANDROID_LOGIN_PASSWORD;
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

/** Dismisses the Android runtime permission dialog (location/notifications) if one is shown after launch. */
async function dismissPermissionDialogIfPresent(
  driver: WebdriverIO.Browser,
): Promise<void> {
  const allowButton = driver.$(
    'android=new UiSelector().resourceIdMatches(".*:id/permission_allow_button")',
  );
  const displayed = await allowButton
    .waitForDisplayed({ timeout: 5000 })
    .catch(() => false);
  if (displayed) {
    await allowButton.click().catch(() => {});
    await driver.pause(1000);
  }
}

/**
 * Logs into the app via the Account tab. Returns true once the login form (email/password
 * fields) is confirmed GONE after re-opening the Account tab, false otherwise — callers
 * should treat a false result as "continue as anonymous session" rather than a hard failure.
 *
 * Everything here uses resourceId selectors, NEVER text/content-desc: this is a whitelabel
 * app that ships BR, LATAM (Spanish) and Avon builds from the same shared UI modules —
 * resource-ids are compile-time identifiers shared across all of them, but visible text and
 * accessibility labels are translated per locale/brand and must not be relied upon.
 */
export async function loginAndroid(
  driver: WebdriverIO.Browser,
  credentials: AndroidCredentials,
): Promise<boolean> {
  try {
    await dismissPermissionDialogIfPresent(driver);

    const accountTab = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/page_account")',
    );
    await accountTab.waitForDisplayed({ timeout: 8000 });
    await accountTab.click();
    console.log("      ✓ Aba Conta aberta");

    // Resource-ids confirmed in ncf-natura-cf-automation-mobile/tests/elements/android/elementsAndroid.js
    const emailClickable = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/text_field_input_main").instance(0)',
    );
    await emailClickable.waitForDisplayed({ timeout: 15000 });
    await emailClickable.click();
    console.log("      ✓ Campo de e-mail aberto");

    const emailField = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/text_field_input_value").instance(0)',
    );
    await emailField.waitForDisplayed({ timeout: 5000 });
    await emailField.setValue(credentials.email);
    console.log("      ✓ E-mail preenchido");

    const passwordClickable = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/text_field_input_main").instance(1)',
    );
    await passwordClickable.click();

    const passwordField = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/text_field_input_value").instance(1)',
    );
    await passwordField.waitForDisplayed({ timeout: 5000 });
    await passwordField.setValue(credentials.password);
    console.log("      ✓ Senha preenchida");

    const loginButton = driver.$(
      'android=new UiSelector().resourceIdMatches(".*:id/btn_login")',
    );
    await loginButton.waitForDisplayed({ timeout: 5000 });
    await loginButton.click();
    console.log("      ✓ Botão entrar clicado, aguardando confirmação...");
    await driver.pause(3000);

    // Login renders as a modal over Home; re-open Account and check whether the login
    // form (email/password fields) is gone — that's the only reliably locale-independent
    // signal available (the app's current bottom nav has no separate "logged in" tab).
    await accountTab.click().catch(() => {});
    const loginFormStillVisible = await driver
      .$(
        'android=new UiSelector().resourceIdMatches(".*:id/text_field_input_main").instance(0)',
      )
      .waitForDisplayed({ timeout: 5000 })
      .catch(() => false);

    return !loginFormStillVisible;
  } catch (e) {
    console.log(
      `      ❌ Login falhou em: ${e instanceof Error ? e.message : String(e)}`,
    );
    return false;
  }
}
