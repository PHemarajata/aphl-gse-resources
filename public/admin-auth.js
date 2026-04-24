// admin-auth.js
(function () {
  'use strict';

  const CONFIG_STORAGE_KEY = 'aphl_firebase_config';
  const POLICY = window.__ADMIN_AUTH_POLICY__ || {};
  const ALLOWED_DOMAINS = Array.isArray(POLICY.allowedDomains) ? POLICY.allowedDomains.map(v => String(v).toLowerCase()) : [];
  const ALLOWED_EMAILS = Array.isArray(POLICY.allowedEmails) ? POLICY.allowedEmails.map(v => String(v).toLowerCase()) : [];

  const fallbackConfig = {
    apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
    authDomain: 'REPLACE_WITH_FIREBASE_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_FIREBASE_PROJECT_ID'
  };

  const protectedSelectors = [
    '#resourceForm input', '#resourceForm textarea', '#resourceForm button',
    '#importTsvBtn', '#importJsBtn', '#importJsonBtn', '#exportTsvBtn', '#exportJsonBtn',
    '#validateBtn', '#validateAllBtn', '#saveDatabaseBtn', '#publishBtn',
    '#searchResources', '#clearForm', '#compareVersionsBtn', '#compareVersionA', '#compareVersionB'
  ];

  let authReady = false;

  function byId(id) { return document.getElementById(id); }

  function setProtectedUiEnabled(enabled) {
    protectedSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if ('disabled' in el) el.disabled = !enabled;
      });
    });
  }

  function isValidConfig(config) {
    return Boolean(
      config && typeof config.apiKey === 'string' && config.apiKey.trim() && !config.apiKey.startsWith('REPLACE_') &&
      typeof config.authDomain === 'string' && config.authDomain.trim() && !config.authDomain.startsWith('REPLACE_') &&
      typeof config.projectId === 'string' && config.projectId.trim() && !config.projectId.startsWith('REPLACE_')
    );
  }

  function normalizeAuthDomain(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }

  function sanitizeConfig(config) {
    return {
      apiKey: String(config.apiKey || '').trim(),
      authDomain: normalizeAuthDomain(config.authDomain),
      projectId: String(config.projectId || '').trim(),
      appId: String(config.appId || '').trim() || undefined,
      storageBucket: String(config.storageBucket || '').trim() || undefined
    };
  }

  function getStoredConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return null;
      return sanitizeConfig(JSON.parse(raw));
    } catch (_error) {
      return null;
    }
  }

  function persistConfig(config) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(sanitizeConfig(config)));
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }

  async function getHostingAutoConfig() {
    try {
      const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (!response.ok) return null;
      return sanitizeConfig(await response.json());
    } catch (_error) {
      return null;
    }
  }

  async function resolveFirebaseConfig() {
    const hostingConfig = await getHostingAutoConfig();

    const candidates = [
      sanitizeConfig(window.__FIREBASE_CONFIG__ || {}),
      sanitizeConfig(window.FIREBASE_CONFIG || {}),
      hostingConfig,
      getStoredConfig(),
      sanitizeConfig(fallbackConfig)
    ];

    for (const candidate of candidates) {
      if (isValidConfig(candidate)) {
        if (hostingConfig && candidate && hostingConfig.projectId === candidate.projectId) {
          persistConfig(candidate);
        }
        return candidate;
      }
    }

    return null;
  }

  function fillConfigForm(config) {
    const c = config || {};
    byId('cfgApiKey').value = c.apiKey || '';
    byId('cfgAuthDomain').value = c.authDomain || '';
    byId('cfgProjectId').value = c.projectId || '';
    byId('cfgAppId').value = c.appId || '';
    byId('cfgStorageBucket').value = c.storageBucket || '';
  }

  function readConfigForm() {
    return sanitizeConfig({
      apiKey: byId('cfgApiKey')?.value,
      authDomain: byId('cfgAuthDomain')?.value,
      projectId: byId('cfgProjectId')?.value,
      appId: byId('cfgAppId')?.value,
      storageBucket: byId('cfgStorageBucket')?.value
    });
  }

  function showConfigModal(show) {
    const modal = byId('authConfigModal');
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
  }

  function isAuthorizedUser(user, tokenResult) {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    const hasAdminClaim = Boolean(tokenResult && tokenResult.claims && tokenResult.claims.admin === true);

    // Hardened default: admin claim required unless policy explicitly allows domain/email fallback.
    const allowFallback = POLICY.allowDomainOrEmailFallback === true;
    if (hasAdminClaim) return true;
    if (!allowFallback) return false;

    const domainMatch = ALLOWED_DOMAINS.some((domain) => email.endsWith('@' + domain));
    const emailMatch = ALLOWED_EMAILS.includes(email);
    return domainMatch || emailMatch;
  }

  function updateAuthUi(user, authorized, detailMessage) {
    const status = byId('authStatusText');
    const signInBtn = byId('signInBtn');
    const signOutBtn = byId('signOutBtn');

    if (!status || !signInBtn || !signOutBtn) return;

    if (detailMessage) {
      status.textContent = detailMessage;
      status.className = 'ml-1 text-red-700';
      signInBtn.classList.remove('hidden');
      signOutBtn.classList.add('hidden');
      return;
    }
    if (!user) {
      status.textContent = authReady ? 'Not signed in' : 'Auth not configured';
      status.className = 'ml-1 text-red-700';
      signInBtn.classList.remove('hidden');
      signOutBtn.classList.add('hidden');
      return;
    }
    if (!authorized) {
      status.textContent = `Signed in as ${user.email} (not authorized)`;
      status.className = 'ml-1 text-red-700';
      signInBtn.classList.add('hidden');
      signOutBtn.classList.remove('hidden');
      return;
    }

    status.textContent = `Authorized: ${user.email}`;
    status.className = 'ml-1 text-green-700';
    signInBtn.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
  }

  function getAdminSnapshot() {
    if (!window.admin || typeof window.admin.buildCurrentDatabaseSnapshot !== 'function') {
      throw new Error('Admin app not ready. Please wait for data to finish loading.');
    }
    return window.admin.buildCurrentDatabaseSnapshot();
  }

  async function publishToLive(resourcesDatabase) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in first.');

    const tokenResult = await user.getIdTokenResult(true);
    if (!isAuthorizedUser(user, tokenResult)) {
      throw new Error('You are signed in but not authorized to publish.');
    }

    const response = await fetch('/api/saveResources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tokenResult.token
      },
      body: JSON.stringify({ resourcesDatabase })
    });

    if (!response.ok) {
      let detail = 'Publish failed.';
      try {
        const payload = await response.json();
        detail = payload.error || detail;
      } catch (_err) {
        // no-op
      }
      throw new Error(detail);
    }

    return response.json().catch(() => ({}));
  }

  async function bootstrapAuth() {
    const config = await resolveFirebaseConfig();
    if (!config) {
      authReady = false;
      updateAuthUi(null, false, 'Auth not configured. Click Configure Auth and enter Firebase config.');
      return false;
    }

    if (!firebase.apps.length) firebase.initializeApp(config);
    authReady = true;
    return true;
  }

  async function testConfig(config) {
    if (!isValidConfig(config)) {
      alert('Config is invalid. Required: apiKey, authDomain, projectId.');
      return;
    }
    try {
      const tempName = '__auth_test__';
      let app;
      try {
        app = firebase.app(tempName);
      } catch (_err) {
        app = firebase.initializeApp(config, tempName);
      }
      app.auth();
      await app.delete();
      alert('Config looks valid.');
    } catch (error) {
      alert('Config test failed: ' + error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const signInBtn = byId('signInBtn');
    const signOutBtn = byId('signOutBtn');
    const publishBtn = byId('publishBtn');
    const configureBtn = byId('configureAuthBtn');
    const closeConfigBtn = byId('closeAuthConfigBtn');
    const clearConfigBtn = byId('clearAuthConfigBtn');
    const testConfigBtn = byId('testAuthConfigBtn');
    const saveConfigBtn = byId('saveAuthConfigBtn');

    setProtectedUiEnabled(false);

    const initialConfig = await resolveFirebaseConfig();
    fillConfigForm(initialConfig || getStoredConfig() || window.__FIREBASE_CONFIG__ || window.FIREBASE_CONFIG || {});

    configureBtn?.addEventListener('click', () => showConfigModal(true));
    closeConfigBtn?.addEventListener('click', () => showConfigModal(false));
    byId('authConfigModal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'authConfigModal') showConfigModal(false);
    });

    clearConfigBtn?.addEventListener('click', () => {
      clearConfig();
      fillConfigForm({});
      alert('Stored config cleared.');
    });

    testConfigBtn?.addEventListener('click', async () => {
      await testConfig(readConfigForm());
    });

    saveConfigBtn?.addEventListener('click', () => {
      const config = readConfigForm();
      if (!isValidConfig(config)) {
        alert('Config is invalid. Required: apiKey, authDomain, projectId.');
        return;
      }
      persistConfig(config);
      alert('Firebase config saved. Reloading page...');
      window.location.reload();
    });

    const initialized = await bootstrapAuth();
    if (!initialized) return;

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    signInBtn?.addEventListener('click', async () => {
      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (error) {
        const popupBlocked = error && (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request');
        if (popupBlocked) {
          await firebase.auth().signInWithRedirect(provider);
          return;
        }

        if (error && error.code === 'auth/configuration-not-found') {
          const origin = window.location.origin;
          alert(
            'Sign-in failed: Firebase Auth configuration was not found for this app.\n\n' +
            'Checklist:\n' +
            '1) Enable Google provider in Firebase Authentication.\n' +
            '2) Add this domain to Authorized domains: ' + origin + '\n' +
            '3) Ensure apiKey + authDomain + projectId come from the same Firebase web app.\n\n' +
            'If needed, click Configure Auth, verify values, then Save & Reload.'
          );
          return;
        }

        alert('Sign-in failed: ' + error.message);
      }
    });

    signOutBtn?.addEventListener('click', async () => {
      await firebase.auth().signOut();
    });

    publishBtn?.addEventListener('click', async () => {
      try {
        publishBtn.disabled = true;
        const snapshot = getAdminSnapshot();
        await publishToLive(snapshot);
        alert('Published successfully.');
      } catch (error) {
        alert('Publish error: ' + error.message);
      } finally {
        publishBtn.disabled = false;
      }
    });

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        updateAuthUi(null, false);
        setProtectedUiEnabled(false);
        return;
      }

      let authorized = false;
      try {
        const tokenResult = await user.getIdTokenResult(true);
        authorized = isAuthorizedUser(user, tokenResult);
      } catch (_err) {
        authorized = false;
      }

      updateAuthUi(user, authorized);
      setProtectedUiEnabled(authorized);
    });
  });
})();
