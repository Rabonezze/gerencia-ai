// GerencIA: simulador da conversa no WhatsApp e modo ao vivo da seção #demo.

const CHAVE_STORAGE = 'gerencia-api-key';
const MAX_MENSAGENS = 12;
const MAX_PERGUNTA = 300;
const MAX_LINHAS_TABELA = 15;
const TEMPO_SAUDE_MS = 3000;
const TEMPO_ERRO_SWITCH_MS = 4000;

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

function criarLinhaConsulta(texto) {
  const linha = document.createElement('div');
  linha.className = 'wa-tool';
  linha.textContent = texto;
  return linha;
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

function temListaDeObjetos(dados) {
  return (
    Array.isArray(dados) &&
    dados.length > 0 &&
    dados[0] !== null &&
    typeof dados[0] === 'object' &&
    !Array.isArray(dados[0]) &&
    Object.keys(dados[0]).length > 0
  );
}

// Colunas de dinheiro (pelo nome que vem do banco) aparecem como R$ 1.234,56; outros números no padrão brasileiro.
const COLUNA_MONETARIA = /faturamento|valor|total|pre[cç]o|lucro|receita|custo|subtotal|ticket/i;

function formatarCelula(coluna, valor) {
  if (valor == null) return '';
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    if (COLUNA_MONETARIA.test(coluna)) {
      return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  return String(valor);
}

// "faturamento_total" -> "Faturamento total"
function rotuloColuna(coluna) {
  const texto = String(coluna).replace(/_/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function criarTabelaDados(dados) {
  const colunas = Object.keys(dados[0]);
  const tabela = document.createElement('table');

  const cabecalho = document.createElement('thead');
  const linhaCabecalho = document.createElement('tr');
  colunas.forEach((coluna) => {
    const th = document.createElement('th');
    th.textContent = rotuloColuna(coluna);
    linhaCabecalho.append(th);
  });
  cabecalho.append(linhaCabecalho);

  const corpo = document.createElement('tbody');
  dados.slice(0, MAX_LINHAS_TABELA).forEach((item) => {
    const tr = document.createElement('tr');
    colunas.forEach((coluna) => {
      const td = document.createElement('td');
      const valor = item && typeof item === 'object' ? item[coluna] : '';
      td.textContent = formatarCelula(coluna, valor);
      tr.append(td);
    });
    corpo.append(tr);
  });

  tabela.append(cabecalho, corpo);
  return tabela;
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
  // o modo ao vivo fala com a API do seu computador: na versão publicada, o botão fica escondido
  const noComputadorLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (interruptor && !noComputadorLocal) interruptor.hidden = true;
  const waForm = secaoDemo.querySelector('#wa-form');
  const waPergunta = secaoDemo.querySelector('#wa-pergunta');
  const botaoEnviar = waForm?.querySelector('button[type="submit"]');
  const painelAoVivo = secaoDemo.querySelector('#painel-ao-vivo');
  const painelAoVivoSql = secaoDemo.querySelector('#painel-ao-vivo-sql');
  const painelAoVivoDados = secaoDemo.querySelector('#painel-ao-vivo-dados');
  const paineisDemo = [...secaoDemo.querySelectorAll('.tras__cena[role="tabpanel"]')];

  if (
    !waBody ||
    !interruptor ||
    !waForm ||
    !waPergunta ||
    !painelAoVivo ||
    !painelAoVivoSql ||
    !painelAoVivoDados
  ) {
    return;
  }

  let animacaoAtual = null;
  let controladorSaude = null;
  let controladorPergunta = null;
  let indicadorAoVivo = null;
  let timerErroSwitch = null;

  function modoAoVivoLigado() {
    return interruptor.getAttribute('aria-checked') === 'true';
  }

  function cancelarAnimacao() {
    if (!animacaoAtual) return;
    animacaoAtual.cancelada = true;
    animacaoAtual.timers.forEach((id) => clearTimeout(id));
    animacaoAtual.timers.clear();
    animacaoAtual.elementos.forEach((el) => el.remove());
    animacaoAtual.elementos.length = 0;
    animacaoAtual = null;
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

  function mostrarPainelAbaAtiva(abaPreferida) {
    const abaAtiva =
      abaPreferida ||
      secaoDemo.querySelector('button.tab[role="tab"][aria-selected="true"]');
    const idPainel = abaAtiva?.getAttribute('aria-controls');

    paineisDemo.forEach((painel) => {
      painel.hidden = painel.id !== idPainel;
    });
  }

  // Modo demonstração: reproduz pergunta, consulta, digitando e resposta da aba escolhida.
  function reproduzirCena(nomeCena) {
    const cena = dadosDemo.cenas?.[nomeCena];
    if (!cena) return;

    cancelarAnimacao();

    const balaoPergunta = criarBalaoUsuario(cena.pergunta);
    if (prefereMovimentoReduzido()) {
      adicionarElemento(waBody, balaoPergunta);
      adicionarElemento(waBody, criarBalaoBotHtml(cena.resposta));
      return;
    }

    const animacao = { cancelada: false, timers: new Set(), elementos: [] };
    animacaoAtual = animacao;

    const agendar = (fn, atraso) => {
      const id = setTimeout(() => {
        animacao.timers.delete(id);
        if (animacao.cancelada) return;
        fn();
      }, atraso);
      animacao.timers.add(id);
    };

    adicionarElemento(waBody, balaoPergunta);
    animacao.elementos.push(balaoPergunta);

    const { antesDaConsulta, consulta, digitando } = dadosDemo.tempos;

    agendar(() => {
      const linhaConsulta = criarLinhaConsulta(cena.consulta);
      adicionarElemento(waBody, linhaConsulta);
      animacao.elementos.push(linhaConsulta);

      agendar(() => {
        const indicadorDigitando = criarIndicadorDigitando();
        trocarElemento(waBody, linhaConsulta, indicadorDigitando);
        animacao.elementos = [balaoPergunta, indicadorDigitando];

        agendar(() => {
          const balaoResposta = criarBalaoBotHtml(cena.resposta);
          trocarElemento(waBody, indicadorDigitando, balaoResposta);
          animacao.elementos.length = 0;
          if (animacaoAtual === animacao) {
            animacaoAtual = null;
          }
        }, digitando);
      }, consulta);
    }, antesDaConsulta);
  }

  // Modo ao vivo: desliga o interruptor, esconde o campo/tabela e volta ao painel da aba ativa.
  function desligarModoAoVivo(abaPreferida) {
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
    waForm.hidden = true;
    if (botaoEnviar) botaoEnviar.disabled = false;
    painelAoVivo.hidden = true;
    mostrarPainelAbaAtiva(abaPreferida);
  }

  // Modo ao vivo: pede a chave uma vez, testa a saúde da API local e habilita o formulário.
  async function ligarModoAoVivo() {
    cancelarAnimacao();
    limparErroInterruptor();

    let chave = sessionStorage.getItem(CHAVE_STORAGE);
    if (!chave) {
      const digitada = window.prompt(
        'Cole a chave da API (X-API-Key do arquivo .env)'
      );
      if (digitada === null || !digitada.trim()) {
        interruptor.setAttribute('aria-checked', 'false');
        return;
      }
      chave = digitada.trim();
      sessionStorage.setItem(CHAVE_STORAGE, chave);
    }

    interruptor.setAttribute('aria-checked', 'true');

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
    }
  }

  // Modo ao vivo: envia pergunta livre para a API local e exibe resposta + tabela de dados.
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

      const sqlTexto = typeof corpo.sql === 'string' ? corpo.sql.trim() : '';
      const temDados = temListaDeObjetos(corpo.dados);

      if (sqlTexto || temDados) {
        painelAoVivoSql.textContent = sqlTexto;
        if (temDados) {
          const tabela = criarTabelaDados(corpo.dados);
          painelAoVivoDados.replaceChildren(tabela);
        } else {
          painelAoVivoDados.textContent = 'A consulta não retornou linhas.';
        }
        paineisDemo.forEach((painel) => {
          painel.hidden = true;
        });
        painelAoVivo.hidden = false;
      }
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

  abas.forEach((aba) => {
    aba.addEventListener('click', () => {
      if (modoAoVivoLigado() || controladorSaude) {
        desligarModoAoVivo(aba);
      }
      reproduzirCena(aba.dataset.cena);
    });
  });

  interruptor.addEventListener('click', () => {
    if (modoAoVivoLigado() || controladorSaude) {
      desligarModoAoVivo();
    } else {
      ligarModoAoVivo();
    }
  });

  waForm.addEventListener('submit', enviarPerguntaAoVivo);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarDemo, { once: true });
} else {
  iniciarDemo();
}

export {};
