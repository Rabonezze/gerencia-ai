// Gerencia AI: demonstração em loop automático no WhatsApp e modo ao vivo (#demo).

const CHAVE_STORAGE = 'gerencia-api-key';
const MAX_MENSAGENS = 12;
const MAX_PERGUNTA = 300;
const TEMPO_SAUDE_MS = 3000;
const TEMPO_ERRO_SWITCH_MS = 4000;
const TEMPO_DIGITANDO_LOOP_MS = 1200;
const TEMPO_LEITURA_LOOP_MS = 4000;
const TEMPO_CICLO_ABA_MS = TEMPO_DIGITANDO_LOOP_MS + TEMPO_LEITURA_LOOP_MS;

function formatarHoraAtual() {
  const agora = new Date();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

function prefereMovimentoReduzido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function escaparEFormatarWhatsapp(texto) {
  const seguro = String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return seguro
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/\r\n|\r|\n/g, '<br>');
}

function criarHorario() {
  const horario = document.createElement('small');
  horario.textContent = formatarHoraAtual();
  return horario;
}

function criarBalaoUsuario(texto) {
  const balao = document.createElement('div');
  balao.className = 'wa-msg wa-msg--me';
  balao.append(document.createTextNode(texto), criarHorario());
  return balao;
}

function criarBalaoBotTexto(texto) {
  const balao = document.createElement('div');
  balao.className = 'wa-msg wa-msg--bot';
  balao.append(document.createTextNode(texto), criarHorario());
  return balao;
}

function criarBalaoBotHtml(htmlSeguro) {
  const balao = document.createElement('div');
  balao.className = 'wa-msg wa-msg--bot';
  balao.innerHTML = htmlSeguro;
  balao.append(criarHorario());
  return balao;
}

function criarIndicadorDigitando() {
  const indicador = document.createElement('div');
  indicador.className = 'wa-typing';
  indicador.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    indicador.append(document.createElement('i'));
  }
  return indicador;
}

function limparMensagens(corpoConversa) {
  [...corpoConversa.children].forEach((el) => {
    if (!el.classList.contains('wa__day')) {
      el.remove();
    }
  });
}

function limitarMensagens(corpoConversa) {
  const mensagens = [...corpoConversa.children].filter(
    (el) => !el.classList.contains('wa__day')
  );
  while (mensagens.length > MAX_MENSAGENS) {
    mensagens.shift().remove();
  }
}

function rolarParaOFim(corpoConversa) {
  corpoConversa.scrollTop = corpoConversa.scrollHeight;
}

function adicionarElemento(corpoConversa, elemento) {
  corpoConversa.append(elemento);
  limitarMensagens(corpoConversa);
  rolarParaOFim(corpoConversa);
}

function trocarElemento(corpoConversa, antigo, novo) {
  antigo.replaceWith(novo);
  limitarMensagens(corpoConversa);
  rolarParaOFim(corpoConversa);
}

function iniciarDemo() {
  const secaoDemo = document.getElementById('demo');
  const dadosDemo = window.GERENCIA_DEMO;
  if (!secaoDemo || !dadosDemo) return;

  const abas = [...secaoDemo.querySelectorAll('button.tab[role="tab"][data-cena]')];
  const waBody = secaoDemo.querySelector('#wa-body');
  const interruptor = secaoDemo.querySelector('#modo-ao-vivo');
  const noComputadorLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (interruptor && !noComputadorLocal) interruptor.hidden = true;

  const waForm = secaoDemo.querySelector('#wa-form');
  const waPergunta = secaoDemo.querySelector('#wa-pergunta');
  const botaoEnviar = waForm?.querySelector('button[type="submit"]');

  if (!waBody || !abas.length || !interruptor || !waForm || !waPergunta) return;

  let indiceAtual = 0;
  let secaoVisivel = false;
  let jaIniciouLoop = false;
  let faseLoop = 'parado'; // 'parado' | 'digitando' | 'leitura'
  let acumuladoFaseMs = 0;
  let ultimoFrameTs = null;
  let idRaf = null;
  let indicadorLoop = null;

  let controladorSaude = null;
  let controladorPergunta = null;
  let indicadorAoVivo = null;
  let timerErroSwitch = null;

  function modoAoVivoLigado() {
    return interruptor.getAttribute('aria-checked') === 'true';
  }

  function atualizarAbaSelecionada(indice) {
    abas.forEach((aba, i) => {
      const ativa = i === indice;
      aba.setAttribute('aria-selected', String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      if (!ativa) {
        aba.style.setProperty('--tab-prog', '0');
      }
    });
  }

  function definirProgressoAba(indice, progresso) {
    const aba = abas[indice];
    if (!aba) return;
    const valor = Math.max(0, Math.min(1, progresso));
    aba.style.setProperty('--tab-prog', valor.toFixed(4));
  }

  function cancelarRaf() {
    if (idRaf !== null) {
      cancelAnimationFrame(idRaf);
      idRaf = null;
    }
    ultimoFrameTs = null;
  }

  function removerIndicadorLoop() {
    if (indicadorLoop && indicadorLoop.isConnected) {
      indicadorLoop.remove();
    }
    indicadorLoop = null;
  }

  function mostrarCenaImediata(indice, limparAntes = true) {
    cancelarRaf();
    removerIndicadorLoop();
    faseLoop = 'parado';
    acumuladoFaseMs = 0;
    indiceAtual = indice;
    atualizarAbaSelecionada(indice);
    definirProgressoAba(indice, 0);

    const aba = abas[indice];
    const cena = dadosDemo.cenas?.[aba?.dataset.cena];
    if (!cena) return;

    if (limparAntes) {
      limparMensagens(waBody);
    }
    adicionarElemento(waBody, criarBalaoUsuario(cena.pergunta));
    adicionarElemento(waBody, criarBalaoBotHtml(cena.resposta));
  }

  function iniciarCenaLoop(indice, limparAntes = false) {
    if (prefereMovimentoReduzido()) {
      mostrarCenaImediata(indice, true);
      return;
    }

    cancelarRaf();
    removerIndicadorLoop();
    indiceAtual = indice;
    jaIniciouLoop = true;

    const aba = abas[indice];
    const cena = dadosDemo.cenas?.[aba?.dataset.cena];
    if (!cena) return;

    if (limparAntes || indice === 0) {
      limparMensagens(waBody);
    }

    atualizarAbaSelecionada(indice);
    definirProgressoAba(indice, 0);

    adicionarElemento(waBody, criarBalaoUsuario(cena.pergunta));
    indicadorLoop = criarIndicadorDigitando();
    adicionarElemento(waBody, indicadorLoop);

    faseLoop = 'digitando';
    acumuladoFaseMs = 0;
    ultimoFrameTs = null;
    garantirRaf();
  }

  function passoRaf(agora) {
    idRaf = null;
    if (!podeRodarLoop()) {
      ultimoFrameTs = null;
      return;
    }

    if (ultimoFrameTs === null) {
      ultimoFrameTs = agora;
    }
    const delta = Math.min(120, Math.max(0, agora - ultimoFrameTs));
    ultimoFrameTs = agora;
    acumuladoFaseMs += delta;

    const aba = abas[indiceAtual];
    const cena = dadosDemo.cenas?.[aba?.dataset.cena];
    if (!cena) return;

    if (faseLoop === 'digitando') {
      const decorridoTotal = Math.min(TEMPO_DIGITANDO_LOOP_MS, acumuladoFaseMs);
      definirProgressoAba(indiceAtual, decorridoTotal / TEMPO_CICLO_ABA_MS);

      if (acumuladoFaseMs >= TEMPO_DIGITANDO_LOOP_MS) {
        const resposta = criarBalaoBotHtml(cena.resposta);
        if (indicadorLoop && indicadorLoop.isConnected) {
          trocarElemento(waBody, indicadorLoop, resposta);
        } else {
          adicionarElemento(waBody, resposta);
        }
        indicadorLoop = null;
        faseLoop = 'leitura';
        acumuladoFaseMs = 0;
      }
    } else if (faseLoop === 'leitura') {
      const decorridoTotal =
        TEMPO_DIGITANDO_LOOP_MS + Math.min(TEMPO_LEITURA_LOOP_MS, acumuladoFaseMs);
      definirProgressoAba(indiceAtual, decorridoTotal / TEMPO_CICLO_ABA_MS);

      if (acumuladoFaseMs >= TEMPO_LEITURA_LOOP_MS) {
        const proximoIndice = (indiceAtual + 1) % abas.length;
        iniciarCenaLoop(proximoIndice, proximoIndice === 0);
        return;
      }
    }

    garantirRaf();
  }

  function podeRodarLoop() {
    return (
      secaoVisivel &&
      !document.hidden &&
      !modoAoVivoLigado() &&
      !controladorSaude &&
      !prefereMovimentoReduzido()
    );
  }

  function garantirRaf() {
    if (!podeRodarLoop()) {
      cancelarRaf();
      return;
    }
    if (!jaIniciouLoop || faseLoop === 'parado') {
      iniciarCenaLoop(indiceAtual, true);
      return;
    }
    if (idRaf === null) {
      idRaf = requestAnimationFrame(passoRaf);
    }
  }

  function limparErroInterruptor() {
    clearTimeout(timerErroSwitch);
    timerErroSwitch = null;
    interruptor.removeAttribute('data-estado');
  }

  function marcarErroInterruptor() {
    clearTimeout(timerErroSwitch);
    interruptor.setAttribute('data-estado', 'erro');
    timerErroSwitch = setTimeout(() => {
      interruptor.removeAttribute('data-estado');
      timerErroSwitch = null;
    }, TEMPO_ERRO_SWITCH_MS);
  }

  function desligarModoAoVivo(indicePreferido = indiceAtual) {
    if (controladorSaude) {
      controladorSaude.abort();
      controladorSaude = null;
    }
    if (controladorPergunta) {
      controladorPergunta.abort();
      controladorPergunta = null;
    }
    if (indicadorAoVivo) {
      indicadorAoVivo.remove();
      indicadorAoVivo = null;
    }

    interruptor.setAttribute('aria-checked', 'false');
    secaoDemo.removeAttribute('data-ao-vivo');
    waForm.hidden = true;
    if (botaoEnviar) botaoEnviar.disabled = false;

    iniciarCenaLoop(indicePreferido, true);
  }

  async function ligarModoAoVivo() {
    cancelarRaf();
    removerIndicadorLoop();
    faseLoop = 'parado';
    definirProgressoAba(indiceAtual, 0);
    limparErroInterruptor();

    let chave = sessionStorage.getItem(CHAVE_STORAGE);
    if (!chave) {
      const digitada = window.prompt(
        'Cole a chave da API (X-API-Key do arquivo .env)'
      );
      if (digitada === null || !digitada.trim()) {
        interruptor.setAttribute('aria-checked', 'false');
        garantirRaf();
        return;
      }
      chave = digitada.trim();
      sessionStorage.setItem(CHAVE_STORAGE, chave);
    }

    interruptor.setAttribute('aria-checked', 'true');
    secaoDemo.setAttribute('data-ao-vivo', 'true');

    const controlador = new AbortController();
    controladorSaude = controlador;
    let expirou = false;
    const timer = setTimeout(() => {
      expirou = true;
      controlador.abort();
    }, TEMPO_SAUDE_MS);

    try {
      const resposta = await fetch(dadosDemo.api.saude, {
        method: 'GET',
        signal: controlador.signal
      });

      if (controladorSaude !== controlador) return;
      if (resposta.status !== 200) {
        throw new Error('api-indisponivel');
      }

      waForm.hidden = false;
      waPergunta.focus();
      adicionarElemento(
        waBody,
        criarBalaoBotTexto(
          'Modo ao vivo ligado. Pode perguntar o que quiser sobre o mercado de teste.'
        )
      );
    } catch {
      if (controladorSaude !== controlador && !expirou) return;
      interruptor.setAttribute('aria-checked', 'false');
      secaoDemo.removeAttribute('data-ao-vivo');
      waForm.hidden = true;
      marcarErroInterruptor();
      adicionarElemento(
        waBody,
        criarBalaoBotTexto(
          'Não encontrei a API no seu computador. Continuo no modo demonstração.'
        )
      );
    } finally {
      clearTimeout(timer);
      if (controladorSaude === controlador) {
        controladorSaude = null;
      }
      if (!modoAoVivoLigado()) {
        garantirRaf();
      }
    }
  }

  async function enviarPerguntaAoVivo(evento) {
    evento.preventDefault();
    if (!modoAoVivoLigado() || controladorPergunta) return;

    const texto = waPergunta.value.trim();
    if (!texto || texto.length > MAX_PERGUNTA) return;

    const chave = sessionStorage.getItem(CHAVE_STORAGE) || '';

    waPergunta.value = '';
    if (botaoEnviar) botaoEnviar.disabled = true;

    adicionarElemento(waBody, criarBalaoUsuario(texto));
    const digitando = criarIndicadorDigitando();
    indicadorAoVivo = digitando;
    adicionarElemento(waBody, digitando);

    const controlador = new AbortController();
    controladorPergunta = controlador;
    let expirou = false;
    const timer = setTimeout(() => {
      expirou = true;
      controlador.abort();
    }, dadosDemo.api.limiteMs);

    try {
      const resposta = await fetch(dadosDemo.api.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': chave
        },
        body: JSON.stringify({ pergunta: texto }),
        signal: controlador.signal
      });

      if (controladorPergunta !== controlador) return;

      if (resposta.status === 401) {
        sessionStorage.removeItem(CHAVE_STORAGE);
        throw new Error('nao-autorizado');
      }

      if (!resposta.ok) {
        throw new Error('erro-http');
      }

      const corpo = await resposta.json();
      if (controladorPergunta !== controlador) return;

      if (!corpo || !corpo.sucesso) {
        throw new Error('resposta-sem-sucesso');
      }

      const htmlResposta = escaparEFormatarWhatsapp(corpo.resposta);
      trocarElemento(waBody, digitando, criarBalaoBotHtml(htmlResposta));
      indicadorAoVivo = null;
    } catch {
      if (controladorPergunta !== controlador && !expirou) return;
      const aviso = criarBalaoBotTexto(
        'Não consegui responder agora. Tente de novo ou use as perguntas de exemplo.'
      );
      if (digitando.isConnected) {
        trocarElemento(waBody, digitando, aviso);
      } else {
        adicionarElemento(waBody, aviso);
      }
      indicadorAoVivo = null;
    } finally {
      clearTimeout(timer);
      if (controladorPergunta === controlador) {
        controladorPergunta = null;
      }
      if (botaoEnviar) botaoEnviar.disabled = false;
    }
  }

  abas.forEach((aba, indice) => {
    aba.addEventListener('click', () => {
      if (modoAoVivoLigado() || controladorSaude) {
        desligarModoAoVivo(indice);
        return;
      }
      iniciarCenaLoop(indice, true);
    });
  });

  interruptor.addEventListener('click', () => {
    if (modoAoVivoLigado() || controladorSaude) {
      desligarModoAoVivo(indiceAtual);
    } else {
      ligarModoAoVivo();
    }
  });

  waForm.addEventListener('submit', enviarPerguntaAoVivo);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelarRaf();
    } else {
      garantirRaf();
    }
  });

  if ('IntersectionObserver' in window) {
    const observerDemo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          secaoVisivel = entry.isIntersecting;
          if (secaoVisivel) {
            garantirRaf();
          } else {
            cancelarRaf();
          }
        });
      },
      { threshold: 0.15 }
    );
    observerDemo.observe(secaoDemo);
  } else {
    secaoVisivel = true;
    garantirRaf();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarDemo, { once: true });
} else {
  iniciarDemo();
}

export {};
