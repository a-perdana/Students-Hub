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
 *   - ★ Star (2026-05-14) — opens an endorse modal with optional comment
 *     + 3 tag checkboxes (curriculum-aligned / exam-style / conceptual),
 *     writes practice_question_endorsements/{itemId}_{specialistUid} and
 *     bumps the item doc's denormalised endorseCount + endorsedBy[].
 *     Re-opening the modal shows the existing endorsement (edit mode);
 *     hitting Remove deletes the row and decrements the item counts.
 *
 * Public API:
 *
 *   window.installObserverStrip({
 *     collection: 'practice_questions',           // string — Firestore collection name
 *     chDeeplink: 'practice-bank-admin?item=',    // string — CH page slug + query param prefix
 *     stripEl:    document.getElementById('obsStrip'),
 *     elements: {
 *       idEl, metaEl, copyBtn, openLink,
 *       flagBtn, flagModal, flagModalId, flagReasonSel, flagNoteTa, flagErrEl, flagCancelBtn, flagSubmitBtn,
 *       starBtn, starModal, starModalId, starCommentTa, starTagAligned, starTagExam, starTagConcept,
 *       starErrEl, starCancelBtn, starSubmitBtn, starRemoveBtn,
 *     },
 *     firestore: { addDoc, collection: fbCollection, serverTimestamp,
 *                   doc, getDoc, setDoc, deleteDoc, runTransaction,
 *                   increment, arrayUnion, arrayRemove },
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
    if (!p || p.is_hq_observer !== true) {
      return { update: () => {} };
    }

    const { stripEl, elements, firestore } = opts;
    const {
      idEl, metaEl, copyBtn, openLink,
      flagBtn, flagModal, flagModalId, flagReasonSel, flagNoteTa, flagErrEl, flagCancelBtn, flagSubmitBtn,
      starBtn, starModal, starModalId, starCommentTa, starTagAligned, starTagExam, starTagConcept,
      starErrEl, starCancelBtn, starSubmitBtn, starRemoveBtn,
    } = elements;
    const {
      addDoc, collection: fbCollection, serverTimestamp,
      doc, getDoc, setDoc, deleteDoc, runTransaction,
      increment, arrayUnion, arrayRemove,
    } = firestore;

    let currentItem = null;
    let currentEndorsement = null;  // cached doc for current item (null = not endorsed)

    function endorsementDocId(itemId) {
      return itemId + '_' + window.currentUser.uid;
    }

    async function syncStarBtn() {
      starBtn.disabled = false;
      if (currentEndorsement) {
        starBtn.classList.add('is-starred');
        starBtn.textContent = '★ Starred';
      } else {
        starBtn.classList.remove('is-starred');
        starBtn.textContent = '☆ Star';
      }
    }

    async function loadCurrentEndorsement(item) {
      currentEndorsement = null;
      if (!item || !item.id) { syncStarBtn(); return; }
      try {
        const ref = doc(window.db, 'practice_question_endorsements', endorsementDocId(item.id));
        const snap = await getDoc(ref);
        if (snap.exists()) currentEndorsement = { id: snap.id, ...snap.data() };
      } catch (e) { /* permission-denied is benign — user just sees unstarred */ }
      syncStarBtn();
    }

    function update(item) {
      currentItem = item;
      if (!item) { stripEl.hidden = true; return; }
      stripEl.hidden = false;
      flagBtn.classList.remove('is-flagged');
      flagBtn.textContent = '⚑ Flag';
      flagBtn.disabled = false;

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

      // Load this item's endorsement state for the current specialist
      loadCurrentEndorsement(item);
    }

    copyBtn.addEventListener('click', async () => {
      if (!currentItem) return;
      try {
        await navigator.clipboard.writeText(currentItem.id);
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1200);
      } catch (e) { /* clipboard blocked — silent */ }
    });

    // ─── Flag modal ────────────────────────────────────────────
    flagBtn.addEventListener('click', () => {
      if (!currentItem) return;
      flagModalId.textContent = currentItem.id;
      flagReasonSel.value = 'formatting';
      flagNoteTa.value = '';
      flagErrEl.classList.remove('is-visible');
      flagErrEl.textContent = '';
      flagModal.classList.add('is-open');
      setTimeout(() => flagReasonSel.focus(), 50);
    });
    flagCancelBtn.addEventListener('click', () => flagModal.classList.remove('is-open'));
    flagModal.addEventListener('click', (e) => {
      if (e.target === flagModal) flagModal.classList.remove('is-open');
    });

    flagSubmitBtn.addEventListener('click', async () => {
      if (!currentItem) return;
      flagSubmitBtn.disabled = true;
      flagErrEl.classList.remove('is-visible');
      try {
        const stemSnapshot = (currentItem.stem || currentItem.stemHtml || '').slice(0, 500);
        await addDoc(fbCollection(window.db, 'practice_question_flags'), {
          itemId:          currentItem.id,
          collection:      opts.collection,
          subjectId:       currentItem.subjectId || null,
          topicGroup:      currentItem.topicGroup || null,
          difficulty:      currentItem.difficulty || null,
          type:            currentItem.type || null,
          reason:          flagReasonSel.value,
          note:            flagNoteTa.value.trim().slice(0, 280),
          stemSnapshot,
          flaggerUid:      window.currentUser.uid,
          flaggerName:     window.studentProfile.displayName || '',
          flaggerEmail:    window.studentProfile.email || '',
          schoolId:        window.studentProfile.schoolId || null,
          status:          'open',
          createdAt:       serverTimestamp(),
        });
        flagModal.classList.remove('is-open');
        flagBtn.classList.add('is-flagged');
        flagBtn.textContent = '✓ Flagged';
        flagBtn.disabled = true;
      } catch (e) {
        flagErrEl.textContent = 'Could not submit flag: ' + (e.message || 'unknown error');
        flagErrEl.classList.add('is-visible');
      } finally {
        flagSubmitBtn.disabled = false;
      }
    });

    // ─── Star (endorse) modal ──────────────────────────────────
    function openStarModal() {
      if (!currentItem) return;
      starModalId.textContent = currentItem.id;
      // Prefill from existing endorsement if any
      const e = currentEndorsement;
      starCommentTa.value     = e?.comment || '';
      starTagAligned.checked  = !!e?.tags?.includes('curriculum-aligned');
      starTagExam.checked     = !!e?.tags?.includes('exam-style');
      starTagConcept.checked  = !!e?.tags?.includes('conceptual');
      starRemoveBtn.style.display = e ? '' : 'none';
      starErrEl.classList.remove('is-visible');
      starErrEl.textContent = '';
      starModal.classList.add('is-open');
      setTimeout(() => starCommentTa.focus(), 50);
    }
    starBtn.addEventListener('click', openStarModal);
    starCancelBtn.addEventListener('click', () => starModal.classList.remove('is-open'));
    starModal.addEventListener('click', (e) => {
      if (e.target === starModal) starModal.classList.remove('is-open');
    });

    function gatherTags() {
      const tags = [];
      if (starTagAligned.checked) tags.push('curriculum-aligned');
      if (starTagExam.checked)    tags.push('exam-style');
      if (starTagConcept.checked) tags.push('conceptual');
      return tags;
    }

    starSubmitBtn.addEventListener('click', async () => {
      if (!currentItem) return;
      starSubmitBtn.disabled = true;
      starErrEl.classList.remove('is-visible');
      try {
        const wasAlreadyStarred = !!currentEndorsement;
        const ref = doc(window.db, 'practice_question_endorsements', endorsementDocId(currentItem.id));
        // Snapshot the stem at endorsement time so the CH browse page
        // can preview without N+1-fetching the host item doc. Mirrors
        // the practice_question_flags.stemSnapshot pattern.
        const stemSnapshot = (currentItem.stemHtml || currentItem.stem || '').slice(0, 500);
        const payload = {
          itemId:           currentItem.id,
          collection:       opts.collection,
          subjectId:        currentItem.subjectId || null,
          topicGroup:       currentItem.topicGroup || null,
          difficulty:       currentItem.difficulty || null,
          type:             currentItem.type || null,
          stemSnapshot,
          sourceCode:       currentItem.sourceCode || null,
          specialistUid:    window.currentUser.uid,
          specialistName:   window.studentProfile.displayName || '',
          specialistEmail:  window.studentProfile.email || '',
          comment:          starCommentTa.value.trim().slice(0, 280),
          tags:             gatherTags(),
          updatedAt:        serverTimestamp(),
        };
        if (!wasAlreadyStarred) payload.createdAt = serverTimestamp();

        await setDoc(ref, payload, { merge: true });

        // Denormalise count + array onto the item doc — best-effort.
        // Skipped on the first star bump if the item collection blocks
        // self-update (e.g. chapter_test_items only admins write).
        // CH-side endorsements page can re-derive from
        // practice_question_endorsements if these drift.
        if (!wasAlreadyStarred) {
          try {
            const itemRef = doc(window.db, opts.collection, currentItem.id);
            await setDoc(itemRef, {
              endorseCount: increment(1),
              endorsedBy:   arrayUnion(window.currentUser.uid),
            }, { merge: true });
          } catch (e) { /* item doc may not be writable from SH — degrade silently */ }
        }

        currentEndorsement = { id: ref.id, ...payload };
        syncStarBtn();
        starModal.classList.remove('is-open');
      } catch (e) {
        starErrEl.textContent = 'Could not save: ' + (e.message || 'unknown error');
        starErrEl.classList.add('is-visible');
      } finally {
        starSubmitBtn.disabled = false;
      }
    });

    starRemoveBtn.addEventListener('click', async () => {
      if (!currentItem || !currentEndorsement) return;
      starRemoveBtn.disabled = true;
      starErrEl.classList.remove('is-visible');
      try {
        const ref = doc(window.db, 'practice_question_endorsements', endorsementDocId(currentItem.id));
        await deleteDoc(ref);
        try {
          const itemRef = doc(window.db, opts.collection, currentItem.id);
          await setDoc(itemRef, {
            endorseCount: increment(-1),
            endorsedBy:   arrayRemove(window.currentUser.uid),
          }, { merge: true });
        } catch (e) { /* same fallback as the bump path */ }
        currentEndorsement = null;
        syncStarBtn();
        starModal.classList.remove('is-open');
      } catch (e) {
        starErrEl.textContent = 'Could not remove: ' + (e.message || 'unknown error');
        starErrEl.classList.add('is-visible');
      } finally {
        starRemoveBtn.disabled = false;
      }
    });

    return { update };
  };
})();
