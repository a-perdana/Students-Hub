/* partials/observer-strip.js — Students Hub HQ observer overlay
 *
 * When students/{uid}.is_hq_observer === true, the 3 runner pages
 * (practice-run.html / test.html / ease-test.html) reveal a small
 * amber strip below the question card that shows:
 *
 *   - The item's Firestore doc ID + metadata
 *   - 📋 Copy ID
 *   - ↗ Open in CH (deeplink to the relevant author/admin page)
 *   - ⚑ Flag — opens a reason modal, writes to practice_question_flags
 *
 * Public API:
 *
 *   window.installObserverStrip({
 *     collection: 'practice_questions',           // string — Firestore collection name
 *     chDeeplink: 'practice-bank-admin?item=',    // string — CH page slug + query param prefix
 *     stripEl:    document.getElementById('obsStrip'),
 *     elements:   { idEl, metaEl, copyBtn, openLink, flagBtn, modal, modalId, reasonSel, noteTa, errEl, cancelBtn, submitBtn },
 *     firestore:  { addDoc, collection: fbCollection, serverTimestamp },
 *   })
 *
 * Returns: { update(item) }  — caller calls update() on each question switch.
 *
 * For plain (non-observer) students the install is a no-op — strip stays hidden,
 * no listeners attached, no rule-protected reads attempted.
 */
(function () {
  if (window.installObserverStrip) return;     // idempotent

  window.installObserverStrip = function (opts) {
    const p = window.studentProfile;
    try { console.log('[obs] install — is_hq_observer =', p && p.is_hq_observer, '(type', typeof (p && p.is_hq_observer) + ')'); } catch (_) {}
    if (!p || p.is_hq_observer !== true) {
      return { update: () => {} };
    }
    try { console.log('[obs] install — observer mode active, opts.collection =', opts && opts.collection); } catch (_) {}

    const { stripEl, elements, firestore } = opts;
    const { idEl, metaEl, copyBtn, openLink, flagBtn,
            modal, modalId, reasonSel, noteTa, errEl,
            cancelBtn, submitBtn } = elements;
    const { addDoc, collection: fbCollection, serverTimestamp } = firestore;

    let currentItem = null;

    function update(item) {
      currentItem = item;
      if (!item) { stripEl.hidden = true; return; }
      stripEl.hidden = false;
      flagBtn.classList.remove('is-flagged');
      flagBtn.textContent = '⚑ Flag';
      flagBtn.disabled = false;

      // Diagnostic — log once per item so we can spot why the strip
      // renders but id/meta look empty (e.g. item.id missing or being
      // overridden by a stray `id` field on the doc).
      try { console.log('[obs] update', item.id, Object.keys(item)); } catch (_) {}

      idEl.textContent = item.id || '(no id)';
      const bits = [];
      if (item.type)         bits.push(item.type);
      if (item.subjectId)    bits.push(item.subjectId);
      if (item.topicGroup)   bits.push(item.topicGroup);
      if (item.topic)        bits.push(item.topic);
      if (item.difficulty)   bits.push(item.difficulty);
      if (item.sourceCode)   bits.push(item.sourceCode);
      metaEl.textContent = bits.join(' · ');

      openLink.href = 'https://centralhub.eduversal.org/' + opts.chDeeplink + encodeURIComponent(item.id);
    }

    copyBtn.addEventListener('click', async () => {
      if (!currentItem) return;
      try {
        await navigator.clipboard.writeText(currentItem.id);
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1200);
      } catch (e) { /* clipboard blocked — silent */ }
    });

    flagBtn.addEventListener('click', () => {
      if (!currentItem) return;
      modalId.textContent = currentItem.id;
      reasonSel.value = 'formatting';
      noteTa.value = '';
      errEl.classList.remove('is-visible');
      errEl.textContent = '';
      modal.classList.add('is-open');
      setTimeout(() => reasonSel.focus(), 50);
    });
    cancelBtn.addEventListener('click', () => modal.classList.remove('is-open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('is-open');
    });

    submitBtn.addEventListener('click', async () => {
      if (!currentItem) return;
      submitBtn.disabled = true;
      errEl.classList.remove('is-visible');
      try {
        const stemSnapshot = (currentItem.stem || currentItem.stemHtml || '').slice(0, 500);
        await addDoc(fbCollection(window.db, 'practice_question_flags'), {
          itemId:          currentItem.id,
          collection:      opts.collection,
          subjectId:       currentItem.subjectId || null,
          topicGroup:      currentItem.topicGroup || null,
          difficulty:      currentItem.difficulty || null,
          type:            currentItem.type || null,
          reason:          reasonSel.value,
          note:            noteTa.value.trim().slice(0, 280),
          stemSnapshot,
          flaggerUid:      window.currentUser.uid,
          flaggerName:     window.studentProfile.displayName || '',
          flaggerEmail:    window.studentProfile.email || '',
          schoolId:        window.studentProfile.schoolId || null,
          status:          'open',
          createdAt:       serverTimestamp(),
        });
        modal.classList.remove('is-open');
        flagBtn.classList.add('is-flagged');
        flagBtn.textContent = '✓ Flagged';
        flagBtn.disabled = true;
      } catch (e) {
        errEl.textContent = 'Could not submit flag: ' + (e.message || 'unknown error');
        errEl.classList.add('is-visible');
      } finally {
        submitBtn.disabled = false;
      }
    });

    return { update };
  };
})();
