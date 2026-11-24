// Gerencia AI: animação do filme da abertura (#filme) e da cena de recusa (#recusa).

const PERGUNTA_FILME = 'O que eu preciso repor esta semana?';
const PLACEHOLDER_DIGITAR = 'Mensagem';
const INTERVALO_PALAVRA_MS = 220;
const INTERVALO_LETRA_MS = 45;
const CAMADAS_ESPESSURA = 9;

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
function criarLinhaDoTempo(aoMudarPausa, aoAtualizar) {
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

    if (aoAtualizar) {
      aoAtualizar(tempoDecorrido);
    }

    if ((pendentes > 0 || aoAtualizar) && rodando && !pausado) {
      quadroId = window.requestAnimationFrame(passo);
    } else if (pendentes === 0 && !aoAtualizar) {
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

// Tarefa A: filme da abertura (#filme), com Three.js 3D e plano B em HTML estático.
function configurarFilme() {
  const filme = document.getElementById('filme');
  if (!filme) return null;

  const palco = filme.querySelector('.filme__palco');
  const frase = filme.querySelector('[data-cena="frase"]');
  const botaoRepetir = filme.querySelector('.filme__repetir');

  if (!palco || !frase || !botaoRepetir) {
    return null;
  }

  const textoFraseOriginal = frase.textContent.trim();
  const classesFases = [
    'filme--celular',
    'filme--zoom-icone',
    'filme--icone',
    'filme--toque',
    'filme--zoom-topo',
    'filme--afastar',
    'filme--chat',
    'filme--pergunta',
    'filme--consulta',
    'filme--numeros',
    'filme--resposta'
  ];

  let cena3d = null;
  let promessa3d = null;
  let visivelNaTela = false;
  let jaIniciou = false;
  let desmontado = false;

  const linhaDoTempo = criarLinhaDoTempo(
    (pausado) => {
      filme.classList.toggle('filme--pausado', pausado);
    },
    (tempoMs) => {
      if (cena3d) {
        cena3d.renderizarNoTempo(tempoMs);
      }
    }
  );

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

  function destruirCena3D() {
    if (cena3d) {
      cena3d.destruir();
      cena3d = null;
    }
    filme.classList.remove('filme--3d', 'filme--frase-3d');
  }

  function resetarParaEstadoFinal() {
    linhaDoTempo.cancelar();
    destruirCena3D();
    filme.classList.remove('filme--ativo', 'filme--pausado', ...classesFases);
    frase.classList.remove('is-saindo');
    frase.textContent = textoFraseOriginal;
    botaoRepetir.hidden = true;
  }

  function prepararPalcoVazio(usarFrase3D) {
    filme.classList.remove('filme--pausado', ...classesFases);
    frase.classList.remove('is-saindo');
    botaoRepetir.hidden = true;
    const spans = usarFrase3D ? [] : montarPalavrasDaFrase();
    filme.classList.toggle('filme--frase-3d', usarFrase3D);
    filme.classList.add('filme--ativo');
    // Força recálculo de layout para reiniciar as animações CSS ao repetir o filme.
    void palco.offsetWidth;
    return spans;
  }

  function reproduzirFilme3D() {
    if (desmontado || prefereMovimentoReduzido() || !cena3d) {
      resetarParaEstadoFinal();
      return;
    }

    const palavras = prepararPalcoVazio(cena3d.temFrase3D);
    const eventos = [];

    // 1. Se a fonte 3D não carregou, usa a frase HTML palavra por palavra e saída com blur.
    if (!cena3d.temFrase3D) {
      palavras.forEach((span, indice) => {
        eventos.push({
          emMs: indice * INTERVALO_PALAVRA_MS,
          acao: () => span.classList.add('is-visivel')
        });
        eventos.push({
          emMs: 2400 + indice * 35,
          acao: () => span.classList.add('is-saindo')
        });
      });
    }

    // 2 a 8. Cartões HTML flutuantes sincronizados com a conversa no celular 3D.
    eventos.push({
      emMs: cena3d.tempos.cartaoConsultaMs,
      acao: () => filme.classList.add('filme--consulta')
    });
    eventos.push({
      emMs: cena3d.tempos.cartaoNumerosMs,
      acao: () => filme.classList.add('filme--numeros')
    });
    eventos.push({
      emMs: cena3d.tempos.saidaCartoesMs,
      acao: () => filme.classList.remove('filme--consulta', 'filme--numeros')
    });

    // 9. Loop contínuo: recomeça após ~5 s na cena final.
    eventos.push({
      emMs: cena3d.tempos.duracaoLoopMs,
      acao: () => window.setTimeout(reproduzirFilme3D, 0)
    });

    cena3d.renderizarNoTempo(0);
    linhaDoTempo.iniciar(eventos);
    if (!visivelNaTela || document.hidden) {
      linhaDoTempo.pausar();
    }
  }

  // Carrega o Three.js sob demanda quando #filme se aproxima da janela visível.
  async function carregarCena3D() {
    if (cena3d) return cena3d;
    if (promessa3d) return promessa3d;

    promessa3d = (async () => {
      try {
        const modulo = await import('./filme3d.js?v=6');
        if (desmontado || prefereMovimentoReduzido()) return null;
        const instancia = await modulo.criarCena3D(palco);
        if (!instancia || desmontado || prefereMovimentoReduzido()) {
          instancia?.destruir();
          return null;
        }
        cena3d = instancia;
        filme.classList.add('filme--3d');
        filme.classList.toggle('filme--frase-3d', cena3d.temFrase3D);
        return cena3d;
      } catch {
        // Plano B: mantém a cena final estática em HTML/CSS sem erros.
        return null;
      }
    })();

    return promessa3d;
  }

  botaoRepetir.addEventListener('click', () => {
    if (cena3d) reproduzirFilme3D();
  });

  if (prefereMovimentoReduzido()) {
    return { linhaDoTempo, resetarParaEstadoFinal, deveRetomar: () => false };
  }

  // Observa proximidade para pré-carregar o módulo 3D antes de entrar na tela.
  if ('IntersectionObserver' in window) {
    const observadorCarga = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return;
        observadorCarga.disconnect();
        carregarCena3D();
      },
      { rootMargin: '300px 0px' }
    );
    observadorCarga.observe(filme);

    const observadorVisibilidade = new IntersectionObserver(
      (entradas) => {
        visivelNaTela = entradas.some(
          (entrada) => entrada.isIntersecting && entrada.intersectionRatio >= 0.35
        );

        if (!visivelNaTela) {
          if (jaIniciou) linhaDoTempo.pausar();
          return;
        }

        if (!jaIniciou) {
          jaIniciou = true;
          carregarCena3D().then((instancia) => {
            if (!instancia || desmontado || prefereMovimentoReduzido()) {
              resetarParaEstadoFinal();
              return;
            }
            reproduzirFilme3D();
          });
        } else if (cena3d && !document.hidden) {
          linhaDoTempo.retomar();
        }
      },
      { threshold: [0, 0.35] }
    );
    observadorVisibilidade.observe(filme);
  } else {
    visivelNaTela = true;
    jaIniciou = true;
    carregarCena3D().then((instancia) => {
      if (!instancia) {
        resetarParaEstadoFinal();
        return;
      }
      reproduzirFilme3D();
    });
  }

  window.addEventListener('pagehide', () => {
    desmontado = true;
    linhaDoTempo.cancelar();
    destruirCena3D();
  });

  return {
    linhaDoTempo,
    resetarParaEstadoFinal,
    deveRetomar: () => visivelNaTela && !prefereMovimentoReduzido()
  };
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

  // Espessura do celular 3D: camadas iguais à moldura, empilhadas para trás (só aparecem com o filme ativo).
  const celular = filme.querySelector('.celular');
  if (celular && !celular.querySelector('.celular__lado')) {
    const camadas = document.createDocumentFragment();
    for (let i = 1; i <= CAMADAS_ESPESSURA; i += 1) {
      const lado = document.createElement('span');
      lado.className = 'celular__lado';
      lado.style.setProperty('--i', String(i));
      camadas.append(lado);
    }
    celular.prepend(camadas);
  }

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
    return { linhaDoTempo, resetarParaEstadoFinal, deveRetomar: () => false };
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

  // A recusa roda uma vez só: ao voltar para a aba, basta continuar de onde parou.
  return { linhaDoTempo, resetarParaEstadoFinal };
}

function iniciarCenas() {
  const controladores = [configurarFilme(), configurarRecusa()].filter(Boolean);
  if (!controladores.length) return;

  // Pausa ao sair da aba do navegador e retoma exatamente de onde parou ao voltar.
  document.addEventListener('visibilitychange', () => {
    controladores.forEach(({ linhaDoTempo, deveRetomar }) => {
      if (document.hidden) {
        linhaDoTempo.pausar();
      } else if (!deveRetomar || deveRetomar()) {
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

// Encolhe o celular (sem nunca aumentar) para caber inteiro no palco, com folga em cima e embaixo.
// Assim ele fica centralizado e completo em qualquer zoom do navegador e em qualquer monitor.
const FOLGA_CELULAR_PX = 28;

function ajustarEscalaCelular() {
  document.querySelectorAll('.filme__palco').forEach((palco) => {
    const celular = palco.querySelector('.celular');
    if (!celular || !celular.offsetHeight) return;
    const escala = Math.min(
      1,
      (palco.clientHeight - FOLGA_CELULAR_PX * 2) / celular.offsetHeight,
      (palco.clientWidth - FOLGA_CELULAR_PX * 2) / celular.offsetWidth
    );
    palco.style.setProperty('--escala-celular', Math.max(0.5, escala).toFixed(3));
  });
}

function iniciarEscalaCelular() {
  ajustarEscalaCelular();
  if ('ResizeObserver' in window) {
    const observador = new ResizeObserver(ajustarEscalaCelular);
    document.querySelectorAll('.filme__palco').forEach((palco) => observador.observe(palco));
  } else {
    window.addEventListener('resize', ajustarEscalaCelular);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarCenas, { once: true });
  document.addEventListener('DOMContentLoaded', iniciarEscalaCelular, { once: true });
} else {
  iniciarCenas();
  iniciarEscalaCelular();
}

export { };
