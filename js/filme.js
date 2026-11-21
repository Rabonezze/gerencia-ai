// Gerencia AI: animação do filme da abertura (#filme) e da cena de recusa (#recusa).

const PERGUNTA_FILME = 'O que eu preciso repor esta semana?';
const PLACEHOLDER_DIGITAR = 'Mensagem';
const INTERVALO_PALAVRA_MS = 220;
const INTERVALO_LETRA_MS = 45;

function prefereMovimentoReduzido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

// Linha do tempo pausável: avança com requestAnimationFrame e congela quando a aba fica oculta.
function criarLinhaDoTempo(aoMudarPausa) {
  let eventos = [];
  let tempoDecorrido = 0;
  let ultimoQuadro = 0;
  let quadroId = 0;
  let rodando = false;
  let pausado = false;

  function passo(agora) {
    quadroId = 0;
    if (!rodando || pausado) return;

    const delta = ultimoQuadro ? Math.max(0, Math.min(agora - ultimoQuadro, 250)) : 0;
    ultimoQuadro = agora;
    tempoDecorrido += delta;

    let pendentes = 0;
    for (const item of eventos) {
      if (item.executado) continue;
      if (item.emMs <= tempoDecorrido) {
        item.executado = true;
        item.acao();
      } else {
        pendentes += 1;
      }
    }

    if (pendentes > 0 && rodando && !pausado) {
      quadroId = window.requestAnimationFrame(passo);
    } else if (pendentes === 0) {
      rodando = false;
    }
  }

  function pausar() {
    if (!rodando || pausado) return;
    pausado = true;
    if (quadroId) {
      window.cancelAnimationFrame(quadroId);
      quadroId = 0;
    }
    aoMudarPausa(true);
  }

  function retomar() {
    if (!rodando || !pausado) return;
    pausado = false;
    ultimoQuadro = 0;
    aoMudarPausa(false);
    quadroId = window.requestAnimationFrame(passo);
  }

  function cancelar() {
    rodando = false;
    pausado = false;
    ultimoQuadro = 0;
    if (quadroId) {
      window.cancelAnimationFrame(quadroId);
      quadroId = 0;
    }
    eventos = [];
    aoMudarPausa(false);
  }

  function iniciar(listaEventos) {
    cancelar();
    eventos = listaEventos.map((item) => ({
      emMs: item.emMs,
      acao: item.acao,
      executado: false
    }));
    tempoDecorrido = 0;
    rodando = true;
    if (document.hidden) {
      pausado = true;
      aoMudarPausa(true);
      return;
    }
    ultimoQuadro = 0;
    quadroId = window.requestAnimationFrame(passo);
  }

  return { iniciar, pausar, retomar, cancelar };
}

// Tarefa A: filme da abertura (#filme).
function configurarFilme() {
  const filme = document.getElementById('filme');
  if (!filme) return null;

  const palco = filme.querySelector('.filme__palco');
  const frase = filme.querySelector('[data-cena="frase"]');
  const msgs = filme.querySelector('.celular__msgs');
  const resposta = filme.querySelector('[data-cena="resposta"]');
  const campoDigitar = filme.querySelector('[data-cena="digitando"]');
  const botaoRepetir = filme.querySelector('.filme__repetir');

  if (!palco || !frase || !msgs || !resposta || !campoDigitar || !botaoRepetir) {
    return null;
  }

  const textoFraseOriginal = frase.textContent.trim();
  const classesFases = [
    'filme--celular',
    'filme--toque',
    'filme--chat',
    'filme--pergunta',
    'filme--consulta',
    'filme--numeros',
    'filme--resposta'
  ];

  let indicadorAtual = null;
  let jaIniciou = false;

  const linhaDoTempo = criarLinhaDoTempo((pausado) => {
    filme.classList.toggle('filme--pausado', pausado);
  });

  function removerDigitando() {
    if (indicadorAtual) {
      indicadorAtual.remove();
      indicadorAtual = null;
    }
  }

  function montarPalavrasDaFrase() {
    const palavras = textoFraseOriginal.split(/\s+/).filter(Boolean);
    const fragmento = document.createDocumentFragment();
    const spans = [];

    palavras.forEach((palavra, indice) => {
      if (indice > 0) {
        fragmento.append(document.createTextNode(' '));
      }
      const span = document.createElement('span');
      span.className = 'filme__palavra';
      span.textContent = palavra;
      spans.push(span);
      fragmento.append(span);
    });

    frase.replaceChildren(fragmento);
    return spans;
  }

  function resetarParaEstadoFinal() {
    linhaDoTempo.cancelar();
    removerDigitando();
    filme.classList.remove('filme--ativo', 'filme--pausado', ...classesFases);
    frase.classList.remove('is-saindo');
    frase.textContent = textoFraseOriginal;
    campoDigitar.textContent = PLACEHOLDER_DIGITAR;
    botaoRepetir.hidden = true;
  }

  function prepararPalcoVazio() {
    removerDigitando();
    filme.classList.remove('filme--pausado', ...classesFases);
    frase.classList.remove('is-saindo');
    campoDigitar.textContent = PLACEHOLDER_DIGITAR;
    botaoRepetir.hidden = true;
    const spans = montarPalavrasDaFrase();
    filme.classList.add('filme--ativo');
    // Força recálculo de layout para reiniciar as animações CSS ao repetir o filme.
    void palco.offsetWidth;
    return spans;
  }

  function reproduzirFilme() {
    if (prefereMovimentoReduzido()) {
      resetarParaEstadoFinal();
      return;
    }

    const palavras = prepararPalcoVazio();
    const eventos = [];

    // 1. 0 a 3,2 s: frase palavra por palavra (0,22 s entre palavras), fica 0,8 s inteira e sai.
    palavras.forEach((span, indice) => {
      eventos.push({
        emMs: indice * INTERVALO_PALAVRA_MS,
        acao: () => span.classList.add('is-visivel')
      });
    });

    const fimEntradaFrase = (palavras.length - 1) * INTERVALO_PALAVRA_MS + 450;
    const inicioSaidaFrase = Math.min(2600, fimEntradaFrase + 800);
    eventos.push({
      emMs: inicioSaidaFrase,
      acao: () => frase.classList.add('is-saindo')
    });

    // 2. 3,2 a 4,6 s: celular sobe com a tela inicial visível.
    eventos.push({
      emMs: 3200,
      acao: () => filme.classList.add('filme--celular')
    });

    // 3. 4,6 a 5,6 s: toque no WhatsApp e abertura da conversa.
    eventos.push({
      emMs: 4600,
      acao: () => filme.classList.add('filme--toque')
    });
    eventos.push({
      emMs: 4920,
      acao: () => filme.classList.add('filme--chat')
    });

    // 4. 5,6 a 8,0 s: digitação letra por letra (45 ms/letra), volta para "Mensagem" e envia balão.
    for (let i = 1; i <= PERGUNTA_FILME.length; i += 1) {
      const trecho = PERGUNTA_FILME.slice(0, i);
      eventos.push({
        emMs: 5600 + (i - 1) * INTERVALO_LETRA_MS,
        acao: () => {
          campoDigitar.textContent = trecho;
        }
      });
    }
    eventos.push({
      emMs: 7550,
      acao: () => {
        campoDigitar.textContent = PLACEHOLDER_DIGITAR;
        filme.classList.add('filme--pergunta');
      }
    });

    // 5. 8,0 a 9,6 s: cartão "Consulta conferida" pela esquerda e "digitando…" no chat.
    eventos.push({
      emMs: 8000,
      acao: () => {
        filme.classList.add('filme--consulta');
        removerDigitando();
        indicadorAtual = criarIndicadorDigitando();
        msgs.insertBefore(indicadorAtual, resposta);
      }
    });

    // 6. 9,6 a 11,0 s: troca "digitando…" pela resposta e entra o cartão "Números" pela direita.
    eventos.push({
      emMs: 9600,
      acao: () => {
        removerDigitando();
        filme.classList.add('filme--resposta');
      }
    });
    eventos.push({
      emMs: 9850,
      acao: () => filme.classList.add('filme--numeros')
    });

    // 7. Loop: a cena final fica parada até os 14,5 s e o filme recomeça sozinho (sem botão).
    eventos.push({
      emMs: 14500,
      // fora do laço da linha do tempo, para o recomeço não ser cancelado pelo quadro que ainda está rodando
      acao: () => window.setTimeout(reproduzirFilme, 0)
    });

    linhaDoTempo.iniciar(eventos);
  }

  botaoRepetir.addEventListener('click', reproduzirFilme);

  if (prefereMovimentoReduzido()) {
    return { linhaDoTempo, resetarParaEstadoFinal };
  }

  // Prepara o palco escuro antes de atingir 35% visível para evitar salto visual.
  prepararPalcoVazio();

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.some(
          (entrada) => entrada.isIntersecting && entrada.intersectionRatio >= 0.35
        );
        // Fora da tela o loop fica pausado (não gasta o computador); ao voltar, continua de onde parou.
        if (!visivel) {
          if (jaIniciou) linhaDoTempo.pausar();
          return;
        }
        if (!jaIniciou) {
          jaIniciou = true;
          reproduzirFilme();
        } else if (!document.hidden) {
          linhaDoTempo.retomar();
        }
      },
      { threshold: [0, 0.35] }
    );
    observador.observe(filme);
  } else {
    jaIniciou = true;
    reproduzirFilme();
  }

  return { linhaDoTempo, resetarParaEstadoFinal };
}

// Tarefa B: cena de recusa (#recusa, seção Segurança).
function configurarRecusa() {
  const recusa = document.getElementById('recusa');
  if (!recusa) return null;

  const msgs = recusa.querySelector('.recusa__msgs');
  const pedido = recusa.querySelector('[data-recusa="pedido"]');
  const bloqueio = recusa.querySelector('[data-recusa="bloqueio"]');
  const resposta = recusa.querySelector('[data-recusa="resposta"]');

  if (!msgs || !pedido || !bloqueio || !resposta) return null;

  let indicadorAtual = null;
  let jaIniciou = false;

  const linhaDoTempo = criarLinhaDoTempo((pausado) => {
    recusa.classList.toggle('recusa--pausada', pausado);
  });

  function removerDigitando() {
    if (indicadorAtual) {
      indicadorAtual.remove();
      indicadorAtual = null;
    }
  }

  function resetarParaEstadoFinal() {
    linhaDoTempo.cancelar();
    removerDigitando();
    recusa.classList.remove('recusa--ativa', 'recusa--pausada');
    pedido.classList.remove('is-visivel');
    bloqueio.classList.remove('is-visivel');
    resposta.classList.remove('is-visivel');
  }

  function reproduzirRecusa() {
    if (prefereMovimentoReduzido()) {
      resetarParaEstadoFinal();
      return;
    }

    removerDigitando();
    recusa.classList.add('recusa--ativa');
    pedido.classList.remove('is-visivel');
    bloqueio.classList.remove('is-visivel');
    resposta.classList.remove('is-visivel');

    linhaDoTempo.iniciar([
      {
        emMs: 400,
        acao: () => pedido.classList.add('is-visivel')
      },
      {
        emMs: 1400,
        acao: () => bloqueio.classList.add('is-visivel')
      },
      {
        emMs: 2200,
        acao: () => {
          removerDigitando();
          indicadorAtual = criarIndicadorDigitando();
          msgs.insertBefore(indicadorAtual, resposta);
        }
      },
      {
        emMs: 3400,
        acao: () => {
          removerDigitando();
          resposta.classList.add('is-visivel');
        }
      }
    ]);
  }

  if (prefereMovimentoReduzido()) {
    return { linhaDoTempo, resetarParaEstadoFinal };
  }

  // Esconde os três itens até #recusa ficar 40% visível.
  recusa.classList.add('recusa--ativa');

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.some(
          (entrada) => entrada.isIntersecting && entrada.intersectionRatio >= 0.4
        );
        if (!visivel || jaIniciou) return;
        jaIniciou = true;
        observador.disconnect();
        reproduzirRecusa();
      },
      { threshold: [0.4] }
    );
    observador.observe(recusa);
  } else {
    jaIniciou = true;
    reproduzirRecusa();
  }

  return { linhaDoTempo, resetarParaEstadoFinal };
}

function iniciarCenas() {
  const controladores = [configurarFilme(), configurarRecusa()].filter(Boolean);
  if (!controladores.length) return;

  // Pausa ao sair da aba do navegador e retoma exatamente de onde parou ao voltar.
  document.addEventListener('visibilitychange', () => {
    controladores.forEach(({ linhaDoTempo }) => {
      if (document.hidden) {
        linhaDoTempo.pausar();
      } else {
        linhaDoTempo.retomar();
      }
    });
  });

  // Se o usuário ativar "reduzir movimento" com a página aberta, mostra o estado final parado.
  const consultaMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  consultaMovimento.addEventListener('change', (evento) => {
    if (!evento.matches) return;
    controladores.forEach(({ resetarParaEstadoFinal }) => resetarParaEstadoFinal());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarCenas, { once: true });
} else {
  iniciarCenas();
}

export { };
