// ==UserScript==
// @name         Embaresa — Preencher guia de transporte
// @namespace    embaresa
// @version      1.0.0
// @description  Põe um botão na página das guias do Portal das Finanças que enche os campos com os dados da entrega escolhidos no quiosque. Nunca submete nada.
// @author       Embaresa PT
// @match        https://faturas.portaldasfinancas.gov.pt/DocTransporte/*
// @run-at       document-idle
// @grant        none
// @noframes
// @updateURL    https://embaresa.github.io/Quiosque--Embaresa/preencher-guia.user.js
// @downloadURL  https://embaresa.github.io/Quiosque--Embaresa/preencher-guia.user.js
// ==/UserScript==

/*  Porque é que isto existe
    ------------------------
    A Sónia, 18-09-2026: "não gostaria que eles tivessem que escrever, podia ser um botão na app".
    Um botão dentro do quiosque não consegue mexer nos campos do Portal — o browser proíbe que um
    site escreva na página de outro. O favorito resolvia isso, mas no Chrome do Android não há
    barra de favoritos e obrigava a escrever o nome na barra de endereço.
    Esta extensão é o mesmo código do favorito, mas a correr DENTRO da página do Portal: põe lá
    um botão grande, à vista, que o motorista só tem de tocar.

    De onde vêm os dados, por esta ordem:
      1. do endereço (#embaresa=...), quando é o próprio quiosque a abrir o Portal;
      2. da área de transferência, se o quiosque os copiou com "Copiar dados p/ favorito";
      3. de uma caixa onde se cola à mão, se as duas primeiras falharem.

    Nunca submete o formulário. Preenche, diz quantos campos encheu, e quem carrega em Emitir
    é sempre a pessoa.  */

(function () {
  'use strict';

  var COR = '#0b5cab';

  function $(id) { return document.getElementById(id); }

  function set(id, v) {
    var e = $(id);
    if (!e || v == null || v === '') return 0;
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return 1;
  }

  function sel(id, re) {
    var e = $(id);
    if (!e) return 0;
    var o = Array.prototype.slice.call(e.options).filter(function (x) {
      return re.test(x.text) || re.test(x.value);
    })[0];
    if (!o) return 0;
    e.value = o.value;
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return 1;
  }

  function linhasBens() {
    return Array.prototype.slice.call(document.querySelectorAll('[id^="productDescription_"]'))
      .map(function (e) { return e.id.split('_')[1]; });
  }

  function preencher(d) {
    var n = 0;
    sel('tipoEmissaoId', /determinado/i);
    setTimeout(function () { sel('tipoDocumentoId', /guia de transporte/i); }, 700);

    n += set('customerTaxID', d.nif);
    n += set('customerName', d.nome);
    n += set('customerAddress_addressdetail', d.morada);
    n += set('customerAddress_postalCode', d.cp);
    n += set('customerAddress_city', d.loc);

    n += set('addressFrom_addressdetail', d.cargaMorada);
    n += set('addressFrom_postalCode', d.cargaCp);
    n += set('addressFrom_city', d.cargaLoc);
    n += set('dataCarga', d.data);
    n += set('horaCarga', d.hora);
    n += set('matricula', d.matricula);

    n += set('addressTo_addressdetail', d.descargaMorada || d.morada);
    n += set('addressTo_postalCode', d.descargaCp || d.cp);
    n += set('addressTo_city', d.descargaLoc || d.loc);
    n += set('dataDescarga', d.descargaData || d.data);
    n += set('horaDescarga', d.descargaHora || d.hora);

    encherBens(d.bens || [], n, 0);
  }

  // As linhas dos bens não existem no arranque: o Portal só as desenha depois de escolhido o
  // tipo de documento, e a primeira vez que se tenta ainda não há lá nada. Por isso insiste-se
  // umas vezes antes de desistir, e no fim diz-se quantas linhas ficaram MESMO preenchidas —
  // não o número de caixas que se queria, que era enganador.
  function encherBens(bens, nCampos, tentativa) {
    if (!bens.length) {
      aviso('✓ Guia preenchida: ' + nCampos + ' campos. Confere e carrega em Emitir.', true);
      return;
    }
    var btn = document.querySelector('.addNewLineBtn');
    var faltam = bens.length - linhasBens().length;
    for (var k = 0; k < faltam; k++) { if (btn) btn.click(); }

    setTimeout(function () {
      var ids = linhasBens();
      var feitas = 0;
      bens.forEach(function (x, i) {
        var s = ids[i];
        if (s == null) return;
        set('productDescription_' + s, x.d);
        set('quantity_' + s, String(x.q).replace('.', ','));   // o Portal quer vírgula decimal
        set('unitOfMeasure_' + s, x.u || 'UN');
        feitas++;
      });
      if (feitas === 0 && tentativa < 5) { encherBens(bens, nCampos, tentativa + 1); return; }
      if (feitas < bens.length) {
        aviso('Preenchi ' + nCampos + ' campos, mas só ' + feitas + ' de ' + bens.length +
              ' linhas de bens. Acrescenta as linhas que faltam no Portal e toca outra vez em Preencher guia.', false);
      } else {
        aviso('✓ Guia preenchida: ' + nCampos + ' campos e ' + feitas + ' linha(s) de bens. Confere e carrega em Emitir.', true);
      }
    }, 900);
  }

  /* ---------- painel ---------- */

  var painel, msg;

  function aviso(txt, bom) {
    if (!msg) return;
    msg.textContent = txt;
    msg.style.color = bom ? '#0f5132' : '#842029';
    msg.style.background = bom ? '#d1e7dd' : '#f8d7da';
    msg.style.display = 'block';
  }

  function lerDoEndereco() {
    var m = /[#&]embaresa=([^&]+)/.exec(location.hash || '');
    if (!m) return null;
    try {
      var t = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));   // base64 → texto com acentos
      history.replaceState(null, '', location.pathname + location.search);  // não deixar os dados no endereço
      return t;
    } catch (e) { return null; }
  }

  function interpretar(txt) {
    if (!txt || !/^\s*\{/.test(txt)) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
  }

  function caixaDeColar() {
    var ta = document.createElement('textarea');
    ta.placeholder = 'Cola aqui os dados copiados no quiosque';
    ta.style.cssText = 'width:100%;height:70px;margin-top:8px;border:1px solid #c8d3de;border-radius:8px;padding:8px;font:12px/1.3 monospace';
    var ok = document.createElement('button');
    ok.textContent = 'Preencher com estes dados';
    ok.style.cssText = 'width:100%;margin-top:6px;padding:10px;border:0;border-radius:8px;background:' + COR + ';color:#fff;font-weight:700';
    ok.onclick = function () {
      var d = interpretar(ta.value);
      if (!d) { aviso('Esses dados não vêm no formato certo. No quiosque toca em "Copiar dados p/ favorito" e cola outra vez.', false); return; }
      preencher(d);
    };
    painel.appendChild(ta);
    painel.appendChild(ok);
    ta.focus();
  }

  async function aoTocar() {
    var d = interpretar(lerDoEndereco());
    if (!d) {
      try { d = interpretar(await navigator.clipboard.readText()); } catch (e) { d = null; }
    }
    if (d) { preencher(d); return; }
    aviso('Não encontrei os dados da entrega. Cola-os aqui em baixo.', false);
    caixaDeColar();
  }

  function construir() {
    if ($('embaresaGuiaPainel')) return;

    painel = document.createElement('div');
    painel.id = 'embaresaGuiaPainel';
    painel.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
      'width:min(320px, calc(100vw - 28px))', 'box-sizing:border-box',
      'background:#fff', 'border:1px solid #cfdae6', 'border-radius:14px',
      'box-shadow:0 8px 24px rgba(0,0,0,.18)', 'padding:12px',
      'font:14px/1.4 system-ui,Segoe UI,Roboto,Arial,sans-serif', 'color:#0f172a'
    ].join(';');

    var topo = document.createElement('div');
    topo.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
    var tit = document.createElement('b');
    tit.textContent = 'Embaresa';
    var fechar = document.createElement('button');
    fechar.textContent = '✕';
    fechar.title = 'Esconder';
    fechar.style.cssText = 'border:0;background:transparent;font-size:16px;color:#64748b;padding:2px 6px';
    fechar.onclick = function () { painel.remove(); };
    topo.appendChild(tit); topo.appendChild(fechar);

    var b = document.createElement('button');
    b.textContent = '🚚 Preencher guia';
    b.style.cssText = 'width:100%;padding:16px;border:0;border-radius:10px;background:' + COR +
                      ';color:#fff;font-size:16px;font-weight:700';
    b.onclick = aoTocar;

    msg = document.createElement('div');
    msg.style.cssText = 'display:none;margin-top:8px;padding:8px 10px;border-radius:8px;font-size:12.5px';

    var nota = document.createElement('div');
    nota.style.cssText = 'margin-top:8px;font-size:11.5px;color:#64748b';
    nota.textContent = 'Só enche os campos. Confere sempre e és tu que carregas em Emitir.';

    painel.appendChild(topo);
    painel.appendChild(b);
    painel.appendChild(msg);
    painel.appendChild(nota);
    document.body.appendChild(painel);

    // Se o quiosque abriu o Portal já com os dados no endereço, adianta-se o trabalho.
    if (/[#&]embaresa=/.test(location.hash || '')) setTimeout(aoTocar, 400);
  }

  // O formulário só existe na página de emitir; nas outras do DocTransporte não estorva.
  function ehPaginaDaGuia() {
    return !!($('customerTaxID') || $('tipoEmissaoId') || document.querySelector('[id^="productDescription_"]'));
  }

  if (ehPaginaDaGuia()) construir();
  else {
    // a página carrega pedaços por AJAX: espera-se um pouco por eles
    var tentativas = 0;
    var t = setInterval(function () {
      if (ehPaginaDaGuia()) { clearInterval(t); construir(); }
      else if (++tentativas > 20) clearInterval(t);
    }, 500);
  }
})();
