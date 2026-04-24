// admin-auth.js
(function () {
  'use strict';

  const AUTHORIZED_DOMAIN = 'yourorg.gov';
  const ADMIN_EMAIL_ALLOWLIST = [
    'you@yourorg.gov',
    'colleague@yourorg.gov'
  ];

  const firebaseConfig = window.__FIREBASE_CONFIG__ || {
    apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
    authDomain: 'REPLACE_WITH_FIREBASE_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_FIREBASE_PROJECT_ID'
  };

  const protectedSelectors = [
    '#resourceForm input',
    '#resourceForm textarea',
    '#resourceForm button',
    '#importTsvBtn',
    '#importJsBtn',
    '#importJsonBtn',
    '#exportTsvBtn',
    '#exportJsonBtn',
    '#validateBtn',
    '#validateAllBtn',
    '#saveDatabaseBtn',
    '#publishBtn',
    '#searchResources',
    '#clearForm',
    '#compareVersionsBtn',
    '#compareVersionA',
    '#compareVersionB'
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function setProtectedUiEnabled(enabled) {
    protectedSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if ('disabled' in el) {
          el.disabled = !enabled;
        }
      });
    });
  }

  function hasConfiguredFirebase() {
    return Boolean(
      firebaseConfig &&
      firebaseConfig.apiKey &&
      !firebaseConfig.apiKey.startsWith('REPLACE_') &&
      firebaseConfig.authDomain &&
      !firebaseConfig.authDomain.startsWith('REPLACE_')
    );
  }

  function isAuthorizedUser(user, tokenResult) {
    if (!user || !user.email) return false;

    const email = user.email.toLowerCase();
    const domainAllowed = email.endsWith('@' + AUTHORIZED_DOMAIN);
    const allowlistAllowed = ADMIN_EMAIL_ALLOWLIST.map((v) => v.toLowerCase()).includes(email);
    const hasAdminClaim = Boolean(tokenResult && tokenResult.claims && tokenResult.claims.admin === true);

    return hasAdminClaim || (domainAllowed && allowlistAllowed);
  }

  async function publishToLive(resourcesDatabase) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in first.');

    const token = await user.getIdToken();
    const response = await fetch('/api/saveResources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
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

  function updateAuthUi(user, authorized) {
    const status = byId('authStatusText');
    const signInBtn = byId('signInBtn');
    const signOutBtn = byId('signOutBtn');

    if (!status || !signInBtn || !signOutBtn) return;

    if (!user) {
      status.textContent = 'Not signed in';
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

  document.addEventListener('DOMContentLoaded', async () => {
    const signInBtn = byId('signInBtn');
    const signOutBtn = byId('signOutBtn');
    const publishBtn = byId('publishBtn');

    setProtectedUiEnabled(false);

    if (!hasConfiguredFirebase()) {
      updateAuthUi(null, false);
      byId('authStatusText').textContent = 'Auth not configured. Set window.__FIREBASE_CONFIG__ first.';
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    signInBtn?.addEventListener('click', async () => {
      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (error) {
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

      const tokenResult = await user.getIdTokenResult();
      const authorized = isAuthorizedUser(user, tokenResult);

      updateAuthUi(user, authorized);
      setProtectedUiEnabled(authorized);
    });
  });
})();
