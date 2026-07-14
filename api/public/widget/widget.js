/**
 * Widget de chat Wenoble — prototype vanilla JS, sans build step.
 *
 * Deux états :
 *   - replié : une simple barre de saisie ancrée en bas au centre ;
 *   - déplié : au premier envoi, la zone de conversation prend sa hauteur
 *     (classe `wn-widget--open`) et le widget grandit vers le haut.
 *
 * L'envoi n'appelle pas encore le backend : la logique métier (POST /chat,
 * streaming, RAG) reste à brancher dans `sendMessage`.
 */
(function () {
  'use strict';

  var config = window.WENOBLE_CHAT_CONFIG || {};
  var backendUrl = config.backendUrl || 'http://localhost:3001';

  // Questions proposées au focus, surchargeables depuis le snippet d'intégration.
  var SUGGESTIONS = config.suggestions || [
    'Combien coûte un site Webflow ?',
    'Quels sont vos délais de livraison ?',
    'Quelles prestations proposez-vous ?',
    'Pourquoi Webflow plutôt que WordPress ?',
  ];

  // Message affiché à l'ouverture quand aucune question n'a encore été posée.
  var GREETING =
    config.greeting ||
    "Salut 👋, je suis l'assistant de Wenoble. Une question sur nos offres, nos délais ou ton projet ? N'hésite pas, je te réponds direct.";

  // Pas d'identifiant de session côté client : il est émis par le serveur dans
  // un cookie httpOnly signé, que ce script ne peut ni lire ni modifier.
  // C'est `credentials: 'include'` sur le fetch qui le fait voyager.

  var widget = document.createElement('section');
  widget.className = 'wn-widget';
  widget.innerHTML = [
    '<header class="wn-header">',
    // Logo Wenoble. Les `fill` d'origine étaient en dur ("white") : ils étaient
    // invisibles sur le fond blanc du widget. Ils sont passés à `currentColor`,
    // de sorte que le logo prenne la couleur définie en CSS (.wn-logo).
    '  <svg class="wn-logo" viewBox="0 0 189 30" fill="none" role="img" aria-label="Wenoble" xmlns="http://www.w3.org/2000/svg">',
    '    <path fill-rule="evenodd" clip-rule="evenodd" d="M97.2744 0.00794506C99.0433 -0.0148268 100.893 0.0178104 102.668 0.0255232C102.139 3.5477 101.404 7.26721 100.826 10.8253C101.457 10.2747 102.053 9.49975 102.679 8.99525C108.635 4.20025 116.688 8.15431 115.867 16.0167C115.349 20.9837 114.333 23.703 110.7 27.0109C108.153 29.1964 103.419 30.2831 100.517 28.2091C99.4068 27.4151 98.8584 26.3125 98.2217 25.1525C97.962 26.3796 97.7399 27.6144 97.5537 28.8546L92.25 28.8722C92.3994 27.3287 92.8415 25.1679 93.1201 23.6124L94.6846 14.8956C95.5323 10.1599 96.2595 4.6155 97.2744 0.00794506ZM105.562 11.1788C101.144 11.7225 99.3384 15.8138 99.2363 19.8654C99.1533 23.1602 100.693 25.2212 104.133 25.0617C104.94 24.9083 105.381 24.8137 106.116 24.4445C110.644 22.168 112.998 11.0396 105.562 11.1788Z" fill="currentColor"/>',
    '    <path fill-rule="evenodd" clip-rule="evenodd" d="M83.206 6.91493C93.9351 6.79763 94.6144 18.5668 89.1533 25.1112C86.8436 27.8788 83.6872 29.1359 80.1259 29.3485C69.2336 29.2865 68.5888 18.1241 73.9609 11.1972C76.1461 8.37984 79.7282 7.15528 83.206 6.91493ZM82.4609 10.6942C80.4122 11.0192 78.5438 11.9714 77.4277 13.7509C74.8517 17.8586 73.8017 25.9244 80.8408 25.412C88.4798 24.6213 90.8251 10.0877 82.4609 10.6942Z" fill="currentColor"/>',
    '    <path fill-rule="evenodd" clip-rule="evenodd" d="M137.012 6.91607C139.895 6.8621 143.091 7.89594 144.83 10.2959C146.743 12.9336 146.27 16.5864 145.797 19.5997C140.883 19.5035 135.121 19.4944 130.217 19.6045C130.199 20.2218 130.161 21.0769 130.216 21.6739C130.294 22.5049 130.698 23.2712 131.341 23.8038C132.308 24.6 133.942 24.7655 135.136 24.6163C137.062 24.3757 138.014 23.6639 139.182 22.2305C140.668 22.295 143.568 22.3764 144.935 22.5958C145.048 22.9236 144.934 22.9787 144.755 23.3643C142.495 27.3501 138.696 28.9816 134.362 29.2784C119.826 30.2739 121.653 12.0575 132.021 7.93853C133.842 7.21481 135.107 7.03112 137.012 6.91607ZM136.362 11.5323C133.644 11.7794 131.973 13.2687 130.971 15.7549L135.249 15.7774C136.935 15.7736 138.728 15.8007 140.404 15.7501C140.174 12.9323 139.367 11.6814 136.362 11.5323Z" fill="currentColor"/>',
    '    <path d="M40.4481 6.9134C43.1155 6.69124 46.1635 7.97849 47.6298 10.2611C49.3427 12.9277 49.0643 15.8961 48.4608 18.8314C42.8537 18.912 37.0897 18.838 31.4677 18.8529C29.9251 27.5723 38.9844 29.2101 43.8993 24.2698L44.619 23.4329C45.4594 23.6751 46.1424 23.9707 46.9452 24.305C46.8836 24.3846 46.8215 24.4638 46.7587 24.5423C44.4973 27.3722 42.3392 28.8827 38.662 29.265C27.4405 30.4311 26.5092 18.1766 31.9247 11.3782C34.189 8.53595 36.9152 7.26693 40.4481 6.9134ZM46.1923 15.3382C46.1647 11.2332 43.6323 9.04905 39.6298 9.38508C35.3878 10.2356 33.3393 12.5129 31.8983 16.4945C34.1122 16.5992 36.3929 16.5666 38.6132 16.5638C39.6931 16.5676 45.4182 16.7194 45.955 16.3538C46.1437 16.003 46.1949 15.7282 46.1923 15.3382Z" fill="currentColor"/>',
    '    <path d="M120.018 0.0157682L126.308 0.00390625C124.553 9.60992 122.862 19.2276 121.237 28.8562C119.156 28.875 117.075 28.8713 114.994 28.8453C115.748 23.6789 116.879 18.2387 117.771 13.069C118.518 8.74334 119.206 4.31046 120.018 0.0157682Z" fill="currentColor"/>',
    '    <path d="M27.5186 7.21875L29.8066 7.22622C29.5388 7.93161 29.0712 8.83401 28.7347 9.53026C27.5587 11.7249 26.5225 13.9895 25.4273 16.2232L19.1467 28.8734L16.7915 28.8673C16.5099 25.6424 15.8993 21.7092 15.4473 18.471C15.0706 15.6813 14.7219 12.8879 14.4015 10.0912C12.3027 14.8132 9.74143 19.5053 7.58482 24.2202C6.9122 25.6905 6.12539 27.5645 5.29044 28.8874L2.9184 28.8678C2.32948 22.7704 1.25396 16.6807 0.420436 10.6109C0.264047 9.47214 0.062366 8.37284 0 7.22207L2.30873 7.2331C2.78146 13.1089 3.87867 20.0906 4.66524 26.0179C6.50753 22.3746 8.2916 18.702 10.0166 15.0016C11.0993 12.6924 12.5785 9.40192 13.8417 7.22409L15.9923 7.24188C16.3449 9.24606 16.6111 11.7494 16.8787 13.7863L18.473 25.8899C19.8414 23.3806 21.2076 20.3659 22.4404 17.7696L27.5186 7.21875Z" fill="currentColor"/>',
    '    <path d="M63.0435 6.91211C70.5954 7.24197 69.8434 12.9228 68.7338 18.4284C68.0423 21.8587 67.6534 25.4508 66.8504 28.8917C65.9566 28.8424 64.7868 28.8718 63.8723 28.8729C64.005 27.1478 64.7321 24.8323 64.7749 23.2798C64.875 19.653 68.6236 11.1856 63.465 9.96115C60.5871 9.27794 58.3148 10.0093 56.3428 12.0116C54.5626 14.1792 54.3431 16.9959 53.8719 19.6692C53.3085 22.727 52.8128 25.797 52.3851 28.8768C51.3574 28.845 50.2421 28.8738 49.207 28.8835C49.4193 26.8649 49.9582 24.4297 50.3056 22.4004C51.172 17.3406 52.2381 12.3025 52.9364 7.21517L56.035 7.23651L55.4396 10.8067C58.067 8.00749 59.059 7.21255 63.0435 6.91211Z" fill="currentColor"/>',
    '    <path d="M177.163 5.10631C180.606 5.00608 184.65 5.1152 188.135 5.13169C187.282 10.1716 185.739 15.8649 184.706 20.934C184.206 23.3923 183.55 27.0673 182.933 29.3615C182.629 29.4222 180.102 29.3914 179.665 29.389L172.131 29.3427C172.377 27.0342 173.238 23.7116 173.735 21.372C174.888 15.9407 176.213 10.5863 177.163 5.10631Z" fill="currentColor"/>',
    '    <path d="M166.459 5.03125L172.34 5.07573C171.507 9.24695 170.467 13.4593 169.605 17.6335C168.796 21.546 167.993 25.4487 167.112 29.3466L161.236 29.2972C163.144 21.6298 164.805 12.8208 166.459 5.03125Z" fill="currentColor"/>',
    '    <path d="M157.761 5.09205C158.847 5.04508 160.042 5.08019 161.139 5.09348C159.865 11.9736 158.214 18.7726 156.899 25.6451C156.663 26.8782 156.385 28.1049 156.236 29.3522C155.135 29.3765 153.975 29.3527 152.869 29.3457C153.171 26.9371 153.881 24.2148 154.367 21.8047C155.487 16.2558 156.887 10.6796 157.761 5.09205Z" fill="currentColor"/>',
    '  </svg>',
    '  <button class="wn-close" type="button" aria-label="Fermer la conversation">&times;</button>',
    '</header>',
    '<div class="wn-messages" role="log" aria-live="polite"></div>',
    '<form class="wn-form">',
    '  <div class="wn-input-wrap">',
    // Icône AI. La couleur vient du CSS (.wn-input-icon → violet) via currentColor.
    '    <svg class="wn-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">',
    '      <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>',
    '    </svg>',
    '    <input class="wn-input" type="text" placeholder="Pose ta question…" autocomplete="off" aria-label="Votre question" />',
    '  </div>',
    '  <button class="wn-send" type="submit" aria-label="Envoyer" disabled>',
    // `currentColor` plutôt que `white` en dur : l'icône suit ainsi la couleur
    // du bouton (--wn-accent-fg), et resterait visible si le fond changeait.
    '    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">',
    '      <path d="M8.40001 14H5.6L5.6 5.6L2.8 5.6L2.8 2.8L5.6 2.8L5.6 9.53674e-07H8.40001V2.8L11.2 2.8L11.2 5.6L8.40001 5.6L8.40001 14ZM2.8 8.4H0L0 5.6H2.8L2.8 8.4ZM11.2 5.6H14V8.4H11.2V5.6Z" fill="currentColor"/>',
    '    </svg>',
    '  </button>',
    '</form>',
  ].join('');

  var messages = widget.querySelector('.wn-messages');
  var form = widget.querySelector('.wn-form');
  var input = widget.querySelector('.wn-input');
  var sendBtn = widget.querySelector('.wn-send');
  var closeBtn = widget.querySelector('.wn-close');

  // Vrai dès que le visiteur a posé sa première question.
  var hasAsked = false;
  var greeted = false;

  /** La grille de suggestions, tant qu'elle est affichée. */
  var suggestions = null;

  /**
   * Grille 2x2 des questions prédéfinies, insérée entre la conversation et la
   * barre de saisie (et non dans la zone de messages : elle reste ainsi collée
   * au-dessus de l'input et ne défile pas avec l'historique).
   */
  function showSuggestions() {
    if (suggestions || hasAsked) return;

    suggestions = document.createElement('div');
    suggestions.className = 'wn-suggestions';

    SUGGESTIONS.forEach(function (question) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wn-suggestion';
      btn.textContent = question;
      btn.addEventListener('click', function () {
        if (pending) return; // pas d'envoi pendant qu'une réponse arrive
        sendMessage(question);
      });
      suggestions.appendChild(btn);
    });

    widget.insertBefore(suggestions, form);
  }

  /** Retirée du DOM dès la première question : elle n'a plus lieu d'être. */
  function hideSuggestions() {
    if (!suggestions) return;
    suggestions.remove();
    suggestions = null;
  }

  function open() {
    widget.classList.add('wn-widget--open');

    // Fenêtre vide à la première ouverture : on accueille le visiteur et on lui
    // propose des questions, plutôt que de lui montrer un rectangle blanc.
    if (!greeted && messages.childElementCount === 0) {
      greeted = true;
      appendMessage('assistant', GREETING);
      showSuggestions();
    }
  }

  function close() {
    widget.classList.remove('wn-widget--open');
  }

  function isExpanded() {
    return widget.classList.contains('wn-widget--open');
  }

  /**
   * Rendu Markdown minimal : gras et listes à puces, rien d'autre.
   *
   * Tout est construit avec createElement + textContent, JAMAIS innerHTML :
   * le texte vient d'un LLM, donc potentiellement d'un contenu que quelqu'un a
   * réussi à faire dire au modèle. On ne lui laisse aucune chance d'injecter du
   * HTML dans la page d'un client.
   */
  /** Gras : les segments d'index impair d'un split sur `**` sont les portions grasses. */
  function renderBold(target, text) {
    var parts = text.split('**');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2 === 1) {
        var strong = document.createElement('strong');
        strong.textContent = parts[i];
        target.appendChild(strong);
      } else {
        target.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  var LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

  function renderInline(target, line) {
    var lastIndex = 0;
    var match;

    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(line)) !== null) {
      renderBold(target, line.slice(lastIndex, match.index));

      var a = document.createElement('a');
      a.className = 'wn-link';
      a.textContent = match[1];
      // Seuls http(s) passent (cf. LINK_RE) : un `javascript:` ne peut donc pas
      // se retrouver dans un href. Le texte vient d'un LLM, on ne lui fait pas
      // confiance sur ce point.
      a.href = match[2];
      a.target = '_blank';
      // noopener : sans lui, la page ouverte peut manipuler celle du client
      // via window.opener.
      a.rel = 'noopener noreferrer';
      target.appendChild(a);

      lastIndex = match.index + match[0].length;
    }

    renderBold(target, line.slice(lastIndex));
  }

  function renderMarkdown(el, text) {
    el.textContent = '';
    var lines = text.split('\n');
    var list = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var bullet = /^\s*[-*]\s+(.*)$/.exec(line);

      if (bullet) {
        if (!list) {
          list = document.createElement('ul');
          el.appendChild(list);
        }
        var li = document.createElement('li');
        renderInline(li, bullet[1]);
        list.appendChild(li);
        continue;
      }

      list = null;
      if (!line.trim()) continue;

      var p = document.createElement('p');
      renderInline(p, line);
      el.appendChild(p);
    }
  }

  function appendMessage(role, text) {
    var el = document.createElement('div');
    el.className = 'wn-msg wn-msg--' + role;
    if (role === 'assistant') renderMarkdown(el, text);
    else el.textContent = text; // le message du visiteur reste du texte brut
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  var pending = false;

  /**
   * Envoie la question et affiche la réponse au fil de l'eau.
   *
   * On n'utilise pas EventSource : celui-ci ne sait faire que du GET, or on doit
   * POSTer la question. On lit donc le flux SSE à la main depuis la réponse fetch.
   */
  async function sendMessage(text) {
    open();
    hasAsked = true;
    hideSuggestions(); // place à la conversation
    appendMessage('user', text);

    pending = true;

    // Bulle d'attente : trois points qui rebondissent en cascade. Ils seront
    // remplacés par le texte dès le premier fragment reçu.
    var bubble = appendMessage('assistant', '');
    var typing = document.createElement('div');
    typing.className = 'wn-typing';
    typing.setAttribute('aria-label', 'Réponse en cours de rédaction');
    for (var d = 0; d < 3; d++) typing.appendChild(document.createElement('span'));
    bubble.appendChild(typing);

    var answer = '';

    try {
      var res = await fetch(backendUrl + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Envoie et accepte le cookie de session émis par le backend.
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });

      // 429 : limite de débit atteinte, ou conversation trop longue.
      if (res.status === 429) {
        var payload = await res.json().catch(function () {
          return {};
        });
        var limit = new Error(payload.error || 'Trop de messages. Réessayez dans quelques minutes.');
        // Message destiné au visiteur : on l'affiche tel quel, contrairement
        // aux erreurs techniques.
        limit.userMessage = limit.message;
        throw limit;
      }

      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });

        // Un événement SSE se termine par une ligne vide. Le dernier fragment
        // du buffer peut être incomplet : on le garde pour le tour suivant.
        var parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (var i = 0; i < parts.length; i++) {
          var line = parts[i].trim();
          if (line.indexOf('data: ') !== 0) continue;

          var event = JSON.parse(line.slice(6));

          if (event.type === 'delta') {
            answer += event.text;
            renderMarkdown(bubble, answer);
            messages.scrollTop = messages.scrollHeight;
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      if (!answer.trim()) bubble.textContent = 'Je n\'ai pas de réponse à vous donner.';
    } catch (err) {
      bubble.textContent =
        err.userMessage || 'Désolé, une erreur est survenue. Réessayez dans un instant.';
      console.error('[wenoble-chat]', err);
    } finally {
      pending = false;
      sendBtn.disabled = input.value.trim() === '';
    }
  }

  // Le focus ouvre la fenêtre à sa taille normale. open() se charge d'afficher
  // l'accueil et la grille de suggestions si la conversation est vide.
  input.addEventListener('focus', open);

  // Le bouton d'envoi ne s'active que si le champ n'est pas vide et qu'aucune
  // réponse n'est en cours.
  input.addEventListener('input', function () {
    sendBtn.disabled = pending || input.value.trim() === '';
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text || pending) return; // pas de double envoi pendant une réponse
    input.value = '';
    sendBtn.disabled = true;
    sendMessage(text);
    input.focus();
  });

  // Replier ne détruit rien : la grille de suggestions vit dans la zone de
  // messages, elle-même masquée quand le widget est replié. La retirer ici la
  // ferait disparaître définitivement au premier « fermer / rouvrir ».
  //
  // On ne redonne PAS le focus à l'input : il rouvrirait aussitôt la fenêtre
  // via le listener `focus` ci-dessus.
  function collapse() {
    close();
    input.blur();
  }

  closeBtn.addEventListener('click', collapse);

  // Clic en dehors du widget : on replie. L'historique est conservé, il suffit
  // de revenir dans le champ pour rouvrir.
  document.addEventListener('pointerdown', function (event) {
    if (!isExpanded()) return;
    if (widget.contains(event.target)) return;
    collapse();
  });

  // Échap replie aussi, sans effacer l'historique.
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isExpanded()) collapse();
  });

  // Caché au chargement : le widget ne se révèle qu'au premier défilement vers
  // le haut. Poser la classe AVANT l'insertion évite qu'il apparaisse une frame
  // puis se cache (l'animation partirait dans le mauvais sens).
  widget.classList.add('wn-widget--hidden');
  document.body.appendChild(widget);

  /**
   * Apparition au défilement vers le HAUT uniquement.
   *
   * Remonter la page traduit une hésitation ou une recherche d'information :
   * c'est là que proposer de l'aide a du sens. Descendre, c'est lire — on
   * n'interrompt pas.
   */
  (function scrollReveal() {
    var lastY = window.scrollY;
    var ticking = false;

    // Seuil : en dessous, on ignore. Évite que le moindre tremblement de
    // trackpad (ou le rebond élastique sur iOS) fasse clignoter le widget.
    var THRESHOLD = 8;

    function show() {
      widget.classList.remove('wn-widget--hidden');
    }

    function hide() {
      // On ne cache jamais une conversation ouverte ou une réponse en cours :
      // le visiteur perdrait ce qu'il est en train de lire.
      if (isExpanded() || pending) return;
      widget.classList.add('wn-widget--hidden');
    }

    function update() {
      ticking = false;
      var y = window.scrollY;
      var delta = y - lastY;

      if (Math.abs(delta) < THRESHOLD) return;
      lastY = y;

      if (delta < 0) show();
      else hide();
    }

    window.addEventListener(
      'scroll',
      function () {
        // Le scroll se déclenche très souvent : on ne travaille qu'une fois par
        // frame de rendu, jamais à chaque événement.
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true },
    );
  })();

  /**
   * Restaure la conversation après un rechargement de page.
   *
   * Le widget est reconstruit à zéro à chaque chargement, mais la conversation
   * vit en base, rattachée au cookie de session. On la redemande donc au backend.
   * Le widget reste replié : on ne rouvre pas la fenêtre de force, c'est le
   * focus sur le champ qui la révélera.
   */
  (async function restore() {
    try {
      var res = await fetch(backendUrl + '/history', { credentials: 'include' });
      if (!res.ok) return;

      var data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      data.messages.forEach(function (m) {
        appendMessage(m.role, m.content);
      });

      // La conversation existe : ni message d'accueil, ni suggestions.
      greeted = true;
      hasAsked = true;
    } catch (err) {
      // Backend injoignable : le widget reste utilisable, simplement sans
      // historique. On ne bloque pas le visiteur pour ça.
      console.error('[wenoble-chat] historique indisponible', err);
    }
  })();
})();
