// Gerencia AI: animações de entrada ao rolar (um único IntersectionObserver)
// e loop de digitação da faixa "E qualquer outra pergunta sobre a sua loja".

const FRASES_PERGUNTA = [
  'Quanto vendi de leite hoje?',
  'Qual fornecedor eu mais comprei no mês?',
  'O que vendeu menos que na semana passada?',
  'Quanto lucrei com a padaria em novembro?'
];

const PASSO_DIGITACAO_MS = 45;
const PASSO_APAGAR_MS = 22;
const PAUSA_LEITURA_MS = 1600;
const PAUSA_PROXIMA_MS = 240;

function prefereMovimentoReduzido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function iniciarAnimacoes() {
  const html = document.documentElement;
  const campoDigitado = document.getElementById('pergunta-digitada');
  const faixaPergunta = document.getElementById('faixa-pergunta');

  if (prefereMovimentoReduzido() || !('IntersectionObserver' in window)) {
    if (campoDigitado) campoDigitado.textContent = FRASES_PERGUNTA[0];
    return;
  }

  // Índices internos para cascatas dentro de blocos (.fluxo e .tema li)
  document.querySelectorAll('#seguranca .fluxo > *').forEach((el, idx) => {
    el.style.setProperty('--i', String(idx));
  });
  document.querySelectorAll('#perguntas .tema').forEach((card) => {
    card.querySelectorAll('li').forEach((li, idx) => {
      li.style.setProperty('--li-i', String(idx));
    });
  });

  const alvosEntrada = [
    ...document.querySelectorAll(
      '#problema .comparar__lado, #seguranca .camada, #seguranca .fluxo, #perguntas .tema, #perguntas .faixa-pergunta, #faq .faq__item, #contato .wrap, .rodape .wrap'
    )
  ];

  html.classList.add('js-anima');

  // Loop de digitação da faixa de perguntas (só roda enquanto visível na tela)
  let faixaVisivel = false;
  let timerDigitacao = null;
  let indiceFrase = 0;
  let indiceLetra = FRASES_PERGUNTA[0].length;
  let apagando = false;

  function pararDigitacao() {
    if (timerDigitacao !== null) {
      clearTimeout(timerDigitacao);
      timerDigitacao = null;
    }
  }

  function agendarPassoDigitacao(atraso) {
    pararDigitacao();
    if (!faixaVisivel || document.hidden || prefereMovimentoReduzido()) return;
    timerDigitacao = setTimeout(passoDigitacao, atraso);
  }

  function passoDigitacao() {
    timerDigitacao = null;
    if (!faixaVisivel || document.hidden || !campoDigitado) return;

    const fraseAtual = FRASES_PERGUNTA[indiceFrase];
    if (!apagando) {
      if (indiceLetra < fraseAtual.length) {
        indiceLetra += 1;
        campoDigitado.textContent = fraseAtual.slice(0, indiceLetra);
        agendarPassoDigitacao(PASSO_DIGITACAO_MS);
      } else {
        apagando = true;
        agendarPassoDigitacao(PAUSA_LEITURA_MS);
      }
    } else if (indiceLetra > 0) {
      indiceLetra -= 1;
      campoDigitado.textContent = fraseAtual.slice(0, indiceLetra);
      agendarPassoDigitacao(PASSO_APAGAR_MS);
    } else {
      apagando = false;
      indiceFrase = (indiceFrase + 1) % FRASES_PERGUNTA.length;
      agendarPassoDigitacao(PAUSA_PROXIMA_MS);
    }
  }

  function atualizarEstadoDigitacao() {
    if (!campoDigitado || !faixaPergunta) return;
    if (prefereMovimentoReduzido()) {
      pararDigitacao();
      campoDigitado.textContent = FRASES_PERGUNTA[0];
      return;
    }
    if (faixaVisivel && !document.hidden) {
      if (timerDigitacao === null) {
        agendarPassoDigitacao(
          indiceLetra === FRASES_PERGUNTA[indiceFrase].length && !apagando
            ? PAUSA_LEITURA_MS
            : PASSO_DIGITACAO_MS
        );
      }
    } else {
      pararDigitacao();
    }
  }

  document.addEventListener('visibilitychange', atualizarEstadoDigitacao);

  const conjuntosEntrada = new Set(alvosEntrada);

  // Único IntersectionObserver para todas as animações de entrada + visibilidade da faixa
  const observer = new IntersectionObserver(
    (entries) => {
      let ordemLote = 0;
      entries.forEach((entry) => {
        const alvo = entry.target;

        if (alvo === faixaPergunta) {
          faixaVisivel = entry.isIntersecting;
          atualizarEstadoDigitacao();
        }

        if (entry.isIntersecting && conjuntosEntrada.has(alvo)) {
          conjuntosEntrada.delete(alvo);
          if (alvo.matches('.camada, .tema, .faq__item')) {
            alvo.style.setProperty('--atraso', `${ordemLote * 75}ms`);
            ordemLote += 1;
          }
          alvo.classList.add('is-visivel');
          if (alvo !== faixaPergunta) {
            observer.unobserve(alvo);
          }
        }
      });
    },
    { threshold: 0.2 }
  );

  alvosEntrada.forEach((el) => observer.observe(el));
  if (faixaPergunta && !alvosEntrada.includes(faixaPergunta)) {
    observer.observe(faixaPergunta);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAnimacoes, { once: true });
} else {
  iniciarAnimacoes();
}

export {};
