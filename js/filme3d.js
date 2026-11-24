// Gerencia AI: cena 3D real em WebGL (Three.js) para o filme da abertura (#filme).
// Modela o celular com volume, tela em canvas 1080x2340 px e ícones 3D extrudados dos SVGs.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/SVGLoader.js';

// Dimensões físicas do celular 3D (proporção moderna ~19.5:9, centralizado na origem).
const LARGURA_CEL = 1.54;
const ALTURA_CEL = 3.2;
const ESPESSURA_CEL = 0.158;

// Tela ativa com proporção exata 1080 x 2340 (sem distorção nas fontes).
const CANVAS_W = 1080;
const CANVAS_H = 2340;
const TELA_W = 1.4;
const TELA_H = (TELA_W * CANVAS_H) / CANVAS_W;
const TELA_R = 0.152;
const TELA_Z = 0.0815;

// Grade da tela inicial (4 colunas x 2 linhas; WhatsApp na 2ª linha, 2ª coluna).
const GRADE_TAM_PX = 186;
const GRADE_GAP_X = 58;
const GRADE_GAP_Y = 74;
const GRADE_COLUNAS = 4;
const GRADE_LINHAS = 2;
const GRADE_INICIO_Y = 420;
const WHATS_COL = 1;
const WHATS_LINHA = 1;

// Posição da logo da Gerencia AI no topo da conversa (em pixels do canvas).
const LOGO_CX = 124;
const LOGO_CY = 258;
const LOGO_RAIO_PX = 58;

// Campo de visão da câmera e folga vertical/horizontal para centralização exata.
const CAM_FOV_GRAUS = 32;
const PREENCHIMENTO_V = 0.78;
const PREENCHIMENTO_H = 0.76;

const PERGUNTA_TEXTO = 'O que eu preciso repor esta semana?';
const FONTE_PRINCIPAL = '"Reddit Sans", system-ui, -apple-system, sans-serif';

// Curvas de suavização (sempre suaves, sem tremer).
function limitar01(v) {
  return Math.max(0, Math.min(1, v));
}

function faixa(tempoMs, inicioMs, fimMs) {
  if (fimMs <= inicioMs) return tempoMs >= fimMs ? 1 : 0;
  return limitar01((tempoMs - inicioMs) / (fimMs - inicioMs));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function misturar(a, b, t) {
  return a + (b - a) * t;
}

// Converte coordenadas do canvas (0..1080, 0..2340) para coordenadas locais da tela 3D.
function canvasParaTela(px, py) {
  return {
    x: (px / CANVAS_W - 0.5) * TELA_W,
    y: (0.5 - py / CANVAS_H) * TELA_H
  };
}

function escalaCanvas(px) {
  return (px / CANVAS_W) * TELA_W;
}

function criarFormaRetanguloArredondado(largura, altura, raio) {
  const hw = largura / 2;
  const hh = altura / 2;
  const r = Math.min(raio, hw, hh);
  const forma = new THREE.Shape();
  forma.moveTo(-hw + r, -hh);
  forma.lineTo(hw - r, -hh);
  forma.quadraticCurveTo(hw, -hh, hw, -hh + r);
  forma.lineTo(hw, hh - r);
  forma.quadraticCurveTo(hw, hh, hw - r, hh);
  forma.lineTo(-hw + r, hh);
  forma.quadraticCurveTo(-hw, hh, -hw, hh - r);
  forma.lineTo(-hw, -hh + r);
  forma.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return forma;
}

function criarGeometriaTelaArredondada(largura, altura, raio) {
  const forma = criarFormaRetanguloArredondado(largura, altura, raio);
  const geom = new THREE.ShapeGeometry(forma, 24);
  const pos = geom.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uvs[i * 2] = pos.getX(i) / largura + 0.5;
    uvs[i * 2 + 1] = pos.getY(i) / altura + 0.5;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geom;
}

function criarTexturaGradienteWhatsapp() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#60D669');
  grad.addColorStop(1, '#1FAF38');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarTexturaSombraRadial(opacidadeCentral = 0.55) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, `rgba(0, 0, 0, ${opacidadeCentral})`);
  grad.addColorStop(0.55, `rgba(0, 0, 0, ${opacidadeCentral * 0.42})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarTexturaOndaLuz() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 30, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.55, 'rgba(210, 255, 232, 0.25)');
  grad.addColorStop(0.76, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.9, 'rgba(96, 214, 105, 0.45)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Auxiliar para desenhar retângulo arredondado no canvas 2D (com cantos individuais).
function tracarBalao(ctx, x, y, w, h, rTL, rTR, rBR, rBL) {
  ctx.beginPath();
  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  ctx.lineTo(x + w, y + h - rBR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  ctx.lineTo(x + rBL, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  ctx.lineTo(x, y + rTL);
  ctx.quadraticCurveTo(x, y, x + rTL, y);
  ctx.closePath();
}

// Desenhista da tela em alta resolução (1080 x 2340 px); redesenha só quando o estado muda.
function criarDesenhistaTela(anisotropiaMax) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = anisotropiaMax;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.magFilter = THREE.LinearFilter;
  textura.generateMipmaps = true;

  // Coordenada central do ícone do WhatsApp no canvas (para a abertura crescer a partir dele).
  const larguraGrade = GRADE_COLUNAS * GRADE_TAM_PX + (GRADE_COLUNAS - 1) * GRADE_GAP_X;
  const margemEsq = (CANVAS_W - larguraGrade) / 2;
  const whatsCx = margemEsq + WHATS_COL * (GRADE_TAM_PX + GRADE_GAP_X) + GRADE_TAM_PX / 2;
  const whatsCy = GRADE_INICIO_Y + WHATS_LINHA * (GRADE_TAM_PX + GRADE_GAP_Y);

  let assinaturaAnterior = '';

  function desenharBarraStatus(corTexto) {
    ctx.save();
    ctx.fillStyle = corTexto;
    ctx.font = `600 44px ${FONTE_PRINCIPAL}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('07:41', 86, 86);
    ctx.textAlign = 'right';
    ctx.fillText('5G', CANVAS_W - 86, 86);
    ctx.restore();
  }

  function desenharTelaInicial() {
    const fundo = ctx.createLinearGradient(0, 0, CANVAS_W * 0.25, CANVAS_H);
    fundo.addColorStop(0, '#1d5f63');
    fundo.addColorStop(0.55, '#134048');
    fundo.addColorStop(1, '#0e2a33');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Brilho sutil no papel de parede para valorizar os ícones 3D.
    const brilho = ctx.createRadialGradient(
      CANVAS_W * 0.5,
      CANVAS_H * 0.28,
      40,
      CANVAS_W * 0.5,
      CANVAS_H * 0.3,
      760
    );
    brilho.addColorStop(0, 'rgba(111, 224, 207, 0.22)');
    brilho.addColorStop(1, 'rgba(111, 224, 207, 0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Barra inferior translúcida (dock discreto, sem ícones de marca).
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    tracarBalao(ctx, 90, 2055, CANVAS_W - 180, 178, 56, 56, 56, 56);
    ctx.fill();

    // Indicador inferior de gesto.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    tracarBalao(ctx, (CANVAS_W - 320) / 2, 2282, 320, 14, 7, 7, 7, 7);
    ctx.fill();

    desenharBarraStatus('#ffffff');
  }

  function desenharConversa(estado) {
    // Fundo principal da conversa WhatsApp.
    ctx.fillStyle = '#efeae2';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Topo (#f0f2f5) cobrindo barra de status + cabeçalho da conversa.
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, CANVAS_W, 346);
    ctx.fillStyle = 'rgba(17, 27, 33, 0.08)';
    ctx.fillRect(0, 344, CANVAS_W, 3);

    desenharBarraStatus('#111b21');

    // Espaço sutil sob a logo 3D da Gerencia AI (dá apoio visual quando a logo levanta).
    ctx.save();
    ctx.beginPath();
    ctx.arc(LOGO_CX, LOGO_CY, LOGO_RAIO_PX, 0, Math.PI * 2);
    ctx.fillStyle = estado.logoElevacao > 0.04 ? 'rgba(13, 116, 128, 0.16)' : '#0d7480';
    ctx.fill();
    ctx.restore();

    // Nome e status ao lado da logo 3D.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111b21';
    ctx.font = `600 54px ${FONTE_PRINCIPAL}`;
    ctx.fillText('Gerencia AI', 208, 236);
    ctx.fillStyle = '#54656f';
    ctx.font = `400 40px ${FONTE_PRINCIPAL}`;
    ctx.fillText('online', 208, 294);
    ctx.restore();

    // Balão verde da pergunta (à direita).
    let yAposPergunta = 408;
    if (estado.progressoPergunta > 0) {
      const p = easeOutCubic(estado.progressoPergunta);
      const bx = 186;
      const bw = 846;
      const bh = 166;
      const by = 408 + (1 - p) * 34;

      ctx.save();
      ctx.globalAlpha = p;
      ctx.shadowColor = 'rgba(17, 27, 33, 0.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#d9fdd3';
      tracarBalao(ctx, bx, by, bw, bh, 34, 12, 34, 34);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.fillStyle = '#111b21';
      ctx.font = `400 44px ${FONTE_PRINCIPAL}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(PERGUNTA_TEXTO, bx + 38, by + 34);

      ctx.fillStyle = '#54656f';
      ctx.font = `400 34px ${FONTE_PRINCIPAL}`;
      ctx.textAlign = 'right';
      ctx.fillText('07:41', bx + bw - 34, by + bh - 50);
      ctx.restore();

      yAposPergunta = 408 + bh + 34;
    }

    // Três pontinhos de "digitando…" (por 1,5 s antes da resposta).
    if (estado.mostrandoDigitando) {
      const bx = 48;
      const by = yAposPergunta;
      const bw = 204;
      const bh = 98;

      ctx.save();
      ctx.shadowColor = 'rgba(17, 27, 33, 0.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#ffffff';
      tracarBalao(ctx, bx, by, bw, bh, 12, 34, 34, 34);
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < 3; i += 1) {
        const fase = estado.faseDigitando * Math.PI * 2 - i * 0.9;
        const pulso = Math.max(0, Math.sin(fase));
        const cx = bx + 58 + i * 44;
        const cy = by + 49 - pulso * 10;
        ctx.save();
        ctx.fillStyle = `rgba(84, 101, 111, ${(0.38 + pulso * 0.56).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Balão branco da resposta (à esquerda, com os números reais da demonstração).
    if (estado.progressoResposta > 0) {
      const p = easeOutCubic(estado.progressoResposta);
      const bx = 48;
      const bw = 918;
      const bh = 558;
      const by = yAposPergunta + (1 - p) * 34;

      ctx.save();
      ctx.globalAlpha = p;
      ctx.shadowColor = 'rgba(17, 27, 33, 0.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#ffffff';
      tracarBalao(ctx, bx, by, bw, bh, 12, 34, 34, 34);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = p;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#111b21';

      const xTexto = bx + 38;
      let yLinha = by + 38;
      const alturaLinha = 68;

      // Primeira linha com "5 produtos" em negrito.
      ctx.font = `700 44px ${FONTE_PRINCIPAL}`;
      const parteNegrito = '5 produtos';
      ctx.fillText(parteNegrito, xTexto, yLinha);
      const largNegrito = ctx.measureText(parteNegrito).width;
      ctx.font = `400 44px ${FONTE_PRINCIPAL}`;
      ctx.fillText(' estão abaixo do mínimo:', xTexto + largNegrito, yLinha);

      const linhas = [
        '• Café 500g: 6 de 15 un',
        '• Linguiça Toscana: 4,2 de 10 kg',
        '• Feijão Carioca 1kg: 10 de 20 un',
        '• Cerveja Pilsen lata: 18 de 36 un',
        '• Bolo de Cenoura: 3 de 6 un'
      ];
      linhas.forEach((linha) => {
        yLinha += alturaLinha;
        ctx.fillText(linha, xTexto, yLinha);
      });

      ctx.fillStyle = '#54656f';
      ctx.font = `400 34px ${FONTE_PRINCIPAL}`;
      ctx.textAlign = 'right';
      ctx.fillText('07:41', bx + bw - 34, by + bh - 50);
      ctx.restore();
    }

    // Barra de digitar na parte inferior.
    const barraX = 44;
    const barraY = 2076;
    const barraW = CANVAS_W - 88;
    const barraH = 152;

    ctx.save();
    ctx.shadowColor = 'rgba(17, 27, 33, 0.08)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    tracarBalao(ctx, barraX, barraY, barraW, barraH, 76, 76, 76, 76);
    ctx.fill();
    ctx.restore();

    ctx.save();
    tracarBalao(ctx, barraX + 44, barraY, barraW - 88, barraH, 0, 0, 0, 0);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textoBarra = estado.textoDigitando || 'Mensagem';
    ctx.fillStyle = estado.textoDigitando ? '#111b21' : '#54656f';
    ctx.font = `400 46px ${FONTE_PRINCIPAL}`;
    ctx.fillText(textoBarra, barraX + 54, barraY + barraH / 2);

    if (estado.textoDigitando) {
      const larguraTexto = ctx.measureText(textoBarra).width;
      ctx.fillStyle = '#0d7480';
      ctx.fillRect(barraX + 58 + larguraTexto, barraY + 46, 5, 60);
    }
    ctx.restore();

    // Indicador inferior de gesto.
    ctx.fillStyle = 'rgba(17, 27, 33, 0.22)';
    tracarBalao(ctx, (CANVAS_W - 320) / 2, 2282, 320, 14, 7, 7, 7, 7);
    ctx.fill();
  }

  function atualizar(estado, forcar = false) {
    const faseQuant = estado.mostrandoDigitando ? Math.floor(estado.faseDigitando * 18) : 0;
    const assinatura = [
      estado.aberturaChat.toFixed(3),
      estado.textoDigitando,
      estado.progressoPergunta.toFixed(2),
      estado.mostrandoDigitando ? `1:${faseQuant}` : '0',
      estado.progressoResposta.toFixed(2),
      estado.logoElevacao > 0.04 ? '1' : '0'
    ].join('|');

    if (!forcar && assinatura === assinaturaAnterior) return;
    assinaturaAnterior = assinatura;

    if (estado.aberturaChat <= 0.001) {
      desenharTelaInicial();
    } else if (estado.aberturaChat >= 0.999) {
      desenharConversa(estado);
    } else {
      desenharTelaInicial();
      const t = easeInOutCubic(estado.aberturaChat);
      const raioMax = Math.hypot(CANVAS_W, CANVAS_H);
      const raioAtual = misturar(GRADE_TAM_PX * 0.45, raioMax, t);
      ctx.save();
      ctx.beginPath();
      ctx.arc(whatsCx, whatsCy, raioAtual, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, t * 2.2);
      desenharConversa(estado);
      ctx.restore();
    }

    textura.needsUpdate = true;
  }

  return { textura, atualizar, whatsCx, whatsCy };
}

// Extruda um SVG em um grupo 3D centralizado, ajustado à largura alvo e com espessura exata.
async function extrudarSvg(url, opcoes) {
  const carregador = new SVGLoader();
  // Troca preenchimentos com degradê (url(#...)) por cor sólida: o SVGLoader não lê degradês e a cor
  // final vem do material abaixo. Assim o console fica limpo.
  const texto = (await (await fetch(url)).text()).replace(/url\(#[^)]*\)/g, '#ffffff');
  const dados = carregador.parse(texto);
  const grupo = new THREE.Group();

  const material = new THREE.MeshPhysicalMaterial({
    color: opcoes.cor ?? 0xffffff,
    emissive: opcoes.emissivo ?? 0xffffff,
    emissiveIntensity: opcoes.intensidadeEmissiva ?? 0.14,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12
  });

  dados.paths.forEach((caminho, indice) => {
    if (opcoes.filtro && !opcoes.filtro(caminho, indice)) return;
    const formas = SVGLoader.createShapes(caminho);
    if (!formas.length) return;
    const geom = new THREE.ExtrudeGeometry(formas, {
      depth: opcoes.profundidade,
      bevelEnabled: true,
      bevelThickness: opcoes.biselEspessura,
      bevelSize: opcoes.biselTamanho,
      bevelSegments: 3,
      curveSegments: 24
    });
    const malha = new THREE.Mesh(geom, material);
    grupo.add(malha);
  });

  // Mede, centraliza e inverte o eixo Y (SVG cresce para baixo; Three.js cresce para cima).
  const caixa = new THREE.Box3().setFromObject(grupo);
  const tamanho = new THREE.Vector3();
  const centro = new THREE.Vector3();
  caixa.getSize(tamanho);
  caixa.getCenter(centro);

  const maiorLado = Math.max(tamanho.x, tamanho.y, 0.001);
  const fator = opcoes.tamanhoFinal / maiorLado;
  const fatorZ = opcoes.espessuraFinal
    ? opcoes.espessuraFinal / Math.max(tamanho.z, 0.001)
    : fator;

  grupo.children.forEach((filho) => {
    filho.geometry.translate(-centro.x, -centro.y, -caixa.min.z);
    filho.geometry.scale(fator, -fator, fatorZ);
    filho.geometry.computeVertexNormals();
  });

  return grupo;
}

// Constrói o bloco 3D do ícone do WhatsApp (bloco verde em degradê + desenho extrudado do SVG).
async function criarIconeWhatsapp3D(tam) {
  const grupo = new THREE.Group();
  const profundidade = 0.034;

  // Bloco arredondado com degradê verde (#60D669 -> #1FAF38).
  const geomBloco = new RoundedBoxGeometry(tam, tam, 0.09, 5, tam * 0.24);
  geomBloco.scale(1, 1, profundidade / 0.09);
  geomBloco.computeVertexNormals();

  const matBloco = new THREE.MeshPhysicalMaterial({
    map: criarTexturaGradienteWhatsapp(),
    roughness: 0.24,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14
  });
  const bloco = new THREE.Mesh(geomBloco, matBloco);
  bloco.position.z = profundidade / 2;
  grupo.add(bloco);

  // Extrusão do balão + telefone branco bem à frente da face do bloco (z > profundidade).
  const emblema = await extrudarSvg('assets/icons/whatsapp.svg', {
    cor: 0xffffff,
    emissivo: 0xffffff,
    intensidadeEmissiva: 0.22,
    profundidade: 12,
    biselEspessura: 2.2,
    biselTamanho: 1.4,
    tamanhoFinal: tam * 0.68,
    espessuraFinal: 0.011,
    // Pula o path 0 (fundo verde do SVG) e extruda apenas o contorno branco e o telefone.
    filtro: (_caminho, indice) => indice >= 1
  });
  emblema.position.z = profundidade + 0.001;
  grupo.add(emblema);

  return grupo;
}

// Constrói a logo 3D da Gerencia AI (disco verde-petróleo #0d7480 + 3 barras do favicon.svg).
async function criarLogoGerencia3D(raio) {
  const grupo = new THREE.Group();
  const profundidadeDisco = 0.022;
  const biselDisco = 0.004;

  const formaDisco = new THREE.Shape();
  formaDisco.absarc(0, 0, raio, 0, Math.PI * 2, false);
  const geomDisco = new THREE.ExtrudeGeometry(formaDisco, {
    depth: profundidadeDisco,
    bevelEnabled: true,
    bevelThickness: biselDisco,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 48
  });
  geomDisco.computeVertexNormals();

  const matDisco = new THREE.MeshPhysicalMaterial({
    color: 0x0d7480,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14
  });
  const disco = new THREE.Mesh(geomDisco, matDisco);
  disco.position.z = biselDisco;
  grupo.add(disco);

  const topoDisco = biselDisco + profundidadeDisco + biselDisco;
  const barras = await extrudarSvg('favicon.svg', {
    cor: 0xffffff,
    emissivo: 0xffffff,
    intensidadeEmissiva: 0.22,
    profundidade: 2.4,
    biselEspessura: 0.35,
    biselTamanho: 0.2,
    tamanhoFinal: raio * 1.18,
    espessuraFinal: 0.01
  });
  barras.position.z = topoDisco + 0.001;
  grupo.add(barras);

  return grupo;
}

// Monta a estrutura completa do celular 3D genérico (sem marca, com volume, botões e câmeras).
function construirCorpoCelular(texturaTela) {
  const grupoCelular = new THREE.Group();

  // Corpo metálico escuro com cantos e laterais bem arredondados.
  const geomCorpo = new RoundedBoxGeometry(LARGURA_CEL, ALTURA_CEL, 0.44, 6, 0.21);
  geomCorpo.scale(1, 1, ESPESSURA_CEL / 0.44);
  geomCorpo.computeVertexNormals();

  const matMetal = new THREE.MeshPhysicalMaterial({
    color: 0x22323a,
    metalness: 0.84,
    roughness: 0.24,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.35
  });
  const corpo = new THREE.Mesh(geomCorpo, matMetal);
  grupoCelular.add(corpo);

  // Moldura frontal de vidro escuro brilhante.
  const geomMoldura = criarGeometriaTelaArredondada(LARGURA_CEL - 0.06, ALTURA_CEL - 0.07, 0.18);
  const matMoldura = new THREE.MeshPhysicalMaterial({
    color: 0x091014,
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.06
  });
  const molduraFrontal = new THREE.Mesh(geomMoldura, matMoldura);
  molduraFrontal.position.z = ESPESSURA_CEL / 2 + 0.001;
  grupoCelular.add(molduraFrontal);

  // Tela ativa em alta resolução (cores fiéis, sem escurecer sob o tone mapping).
  const geomTela = criarGeometriaTelaArredondada(TELA_W, TELA_H, TELA_R);
  const matTela = new THREE.MeshBasicMaterial({
    map: texturaTela,
    toneMapped: false
  });
  const telaMesh = new THREE.Mesh(geomTela, matTela);
  telaMesh.position.z = TELA_Z;
  grupoCelular.add(telaMesh);

  // Película de vidro sutil sobre a tela para reflexo físico suave sem perder nitidez.
  const matVidroReflexo = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.055,
    roughness: 0.06,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false
  });
  const vidroReflexo = new THREE.Mesh(geomTela, matVidroReflexo);
  vidroReflexo.position.z = TELA_Z + 0.0012;
  grupoCelular.add(vidroReflexo);

  // Ilha da câmera frontal (pílula escura no topo da tela).
  const ilhaPos = canvasParaTela(CANVAS_W / 2, 86);
  const ilhaW = escalaCanvas(290);
  const ilhaH = escalaCanvas(82);
  // Forma plana em pílula: o RoundedBoxGeometry limita o raio à metade da espessura (0,016) e deixava os cantos retos.
  const geomIlha = criarGeometriaTelaArredondada(ilhaW, ilhaH, ilhaH / 2);
  const matIlha = new THREE.MeshPhysicalMaterial({
    color: 0x070c0f,
    roughness: 0.15,
    metalness: 0.2,
    clearcoat: 0.8
  });
  const ilha = new THREE.Mesh(geomIlha, matIlha);
  ilha.position.set(ilhaPos.x, ilhaPos.y, TELA_Z + 0.004);
  grupoCelular.add(ilha);

  // Lente discreta dentro da ilha frontal.
  const geomLenteFrontal = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 24);
  geomLenteFrontal.rotateX(Math.PI / 2);
  const matLenteVidro = new THREE.MeshPhysicalMaterial({
    color: 0x0c1e28,
    roughness: 0.04,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.03
  });
  const lenteFrontal = new THREE.Mesh(geomLenteFrontal, matLenteVidro);
  lenteFrontal.position.set(ilhaPos.x + ilhaW * 0.24, ilhaPos.y, TELA_Z + 0.01);
  grupoCelular.add(lenteFrontal);

  // Botões laterais metálicos (ligar à direita; volume + ação à esquerda).
  const matBotao = new THREE.MeshPhysicalMaterial({
    color: 0x334752,
    metalness: 0.88,
    roughness: 0.22,
    envMapIntensity: 1.4
  });

  function adicionarBotao(x, y, altura) {
    const geom = new RoundedBoxGeometry(0.032, altura, 0.048, 3, 0.012);
    const botao = new THREE.Mesh(geom, matBotao);
    botao.position.set(x, y, 0);
    grupoCelular.add(botao);
  }
  adicionarBotao(LARGURA_CEL / 2 + 0.008, 0.34, 0.36); // botão ligar
  adicionarBotao(-LARGURA_CEL / 2 - 0.008, 0.86, 0.14); // botão ação
  adicionarBotao(-LARGURA_CEL / 2 - 0.008, 0.54, 0.25); // volume +
  adicionarBotao(-LARGURA_CEL / 2 - 0.008, 0.2, 0.25); // volume -

  // Traseira fosca com módulo de câmera genérico (pílula vertical limpa, sem marca).
  const geomTraseira = criarGeometriaTelaArredondada(LARGURA_CEL - 0.08, ALTURA_CEL - 0.09, 0.175);
  geomTraseira.rotateY(Math.PI);
  const matTraseira = new THREE.MeshPhysicalMaterial({
    color: 0x16242b,
    roughness: 0.44,
    metalness: 0.34,
    clearcoat: 0.2,
    clearcoatRoughness: 0.38
  });
  const traseira = new THREE.Mesh(geomTraseira, matTraseira);
  traseira.position.z = -ESPESSURA_CEL / 2 - 0.001;
  grupoCelular.add(traseira);

  // Módulo de câmeras traseiro (pílula vertical arredondada à esquerda).
  const moduloGrupo = new THREE.Group();
  moduloGrupo.position.set(-0.34, 0.94, -ESPESSURA_CEL / 2 - 0.02);

  const geomModulo = new THREE.ExtrudeGeometry(criarFormaRetanguloArredondado(0.38, 0.78, 0.14), {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 24
  }).translate(0, 0, -0.028);
  const matModulo = new THREE.MeshPhysicalMaterial({
    color: 0x101a20,
    metalness: 0.72,
    roughness: 0.26,
    clearcoat: 0.45
  });
  const modulo = new THREE.Mesh(geomModulo, matModulo);
  moduloGrupo.add(modulo);

  const matAroLente = new THREE.MeshPhysicalMaterial({
    color: 0x3b4f5a,
    metalness: 0.92,
    roughness: 0.18
  });

  [0.18, -0.18].forEach((offsetY) => {
    const aro = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.125, 0.03, 32).rotateX(Math.PI / 2),
      matAroLente
    );
    aro.position.set(0, offsetY, -0.026);
    moduloGrupo.add(aro);

    const vidro = new THREE.Mesh(
      new THREE.CylinderGeometry(0.096, 0.096, 0.034, 32).rotateX(Math.PI / 2),
      matLenteVidro
    );
    vidro.position.set(0, offsetY, -0.028);
    moduloGrupo.add(vidro);
  });

  // Flash LED discreto ao lado do módulo de câmeras.
  const flash = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.012, 24).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xf4ecd6,
      emissive: 0x2c281e,
      roughness: 0.25,
      metalness: 0.1
    })
  );
  flash.position.set(0.32, 0.0, 0.012);
  moduloGrupo.add(flash);

  grupoCelular.add(moduloGrupo);

  return grupoCelular;
}

// Cria toda a cena 3D e devolve o controlador sincronizado pela linha do tempo de filme.js.
export async function criarCena3D(palco) {
  const canvas = document.createElement('canvas');
  canvas.className = 'filme__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  // Testa WebGL antes de inserir o canvas no DOM.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Aguarda fontes locais (Reddit Sans) antes do primeiro desenho da tela.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Segue com fallback de fonte do sistema se algo falhar.
    }
  }

  const cena = new THREE.Scene();

  // Iluminação realista com RoomEnvironment + PMREMGenerator.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambienteCena = new RoomEnvironment();
  const alvoAmbiente = pmrem.fromScene(ambienteCena, 0.04);
  cena.environment = alvoAmbiente.texture;
  cena.environmentIntensity = 0.85;
  ambienteCena.dispose();
  pmrem.dispose();

  const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.2);
  luzPrincipal.position.set(2.4, 3.8, 4.8);
  cena.add(luzPrincipal);

  const luzRecorte = new THREE.DirectionalLight(0x7be8d8, 0.95);
  luzRecorte.position.set(-3.4, 1.6, -2.6);
  cena.add(luzRecorte);

  const luzPiso = new THREE.DirectionalLight(0x16a7a3, 0.36);
  luzPiso.position.set(0, -3.5, 2.2);
  cena.add(luzPiso);

  const camera = new THREE.PerspectiveCamera(CAM_FOV_GRAUS, 16 / 9, 0.1, 40);

  // Tela 2D em alta resolução como CanvasTexture.
  const anisotropiaMax = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
  const tela = criarDesenhistaTela(anisotropiaMax);
  tela.atualizar(
    {
      aberturaChat: 0,
      textoDigitando: '',
      progressoPergunta: 0,
      mostrandoDigitando: false,
      faseDigitando: 0,
      progressoResposta: 0,
      logoElevacao: 0
    },
    true
  );

  const grupoCelular = construirCorpoCelular(tela.textura);
  grupoCelular.visible = false;
  cena.add(grupoCelular);

  // Sombra suave no chão abaixo do celular.
  const matSombraChao = new THREE.MeshBasicMaterial({
    map: criarTexturaSombraRadial(0.5),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sombraChao = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), matSombraChao);
  sombraChao.rotation.x = -Math.PI / 2;
  sombraChao.position.set(0, -ALTURA_CEL / 2 - 0.18, -0.1);
  cena.add(sombraChao);

  // Ícones 3D da tela inicial (4 colunas x 2 linhas, WhatsApp em col 2 / linha 2).
  const grupoHomeIcones = new THREE.Group();
  grupoHomeIcones.position.z = TELA_Z + 0.002;
  grupoCelular.add(grupoHomeIcones);

  const tamIcone3D = escalaCanvas(GRADE_TAM_PX);
  const larguraGradePx = GRADE_COLUNAS * GRADE_TAM_PX + (GRADE_COLUNAS - 1) * GRADE_GAP_X;
  const margemEsqPx = (CANVAS_W - larguraGradePx) / 2;

  const geomIconeNeutro = new RoundedBoxGeometry(tamIcone3D, tamIcone3D, 0.08, 4, tamIcone3D * 0.24);
  geomIconeNeutro.scale(1, 1, 0.026 / 0.08);
  geomIconeNeutro.computeVertexNormals();

  const matNeutroClaro = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    roughness: 0.24,
    metalness: 0.05,
    clearcoat: 0.5
  });
  const matNeutroMenta = new THREE.MeshPhysicalMaterial({
    color: 0x6fe0cf,
    transparent: true,
    opacity: 0.36,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.5
  });

  const posWhats = canvasParaTela(tela.whatsCx, tela.whatsCy);

  for (let linha = 0; linha < GRADE_LINHAS; linha += 1) {
    for (let col = 0; col < GRADE_COLUNAS; col += 1) {
      if (linha === WHATS_LINHA && col === WHATS_COL) continue;
      const indice = linha * GRADE_COLUNAS + col + 1;
      const px = margemEsqPx + col * (GRADE_TAM_PX + GRADE_GAP_X) + GRADE_TAM_PX / 2;
      const py = GRADE_INICIO_Y + linha * (GRADE_TAM_PX + GRADE_GAP_Y);
      const pos = canvasParaTela(px, py);
      const malha = new THREE.Mesh(
        geomIconeNeutro,
        indice % 3 === 0 ? matNeutroMenta : matNeutroClaro
      );
      malha.position.set(pos.x, pos.y, 0.013);
      grupoHomeIcones.add(malha);
    }
  }

  // Carrega em paralelo o ícone 3D do WhatsApp e a logo 3D da Gerencia AI.
  const raioLogo3D = escalaCanvas(LOGO_RAIO_PX);
  const [iconeWhats, logoGerencia] = await Promise.all([
    criarIconeWhatsapp3D(tamIcone3D),
    criarLogoGerencia3D(raioLogo3D)
  ]);

  iconeWhats.position.set(posWhats.x, posWhats.y, 0.002);
  grupoHomeIcones.add(iconeWhats);

  // Sombra projetada pelo ícone do WhatsApp na tela ao levantar.
  const matSombraWhats = new THREE.MeshBasicMaterial({
    map: criarTexturaSombraRadial(0.65),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sombraWhats = new THREE.Mesh(
    new THREE.PlaneGeometry(tamIcone3D * 1.45, tamIcone3D * 1.45),
    matSombraWhats
  );
  sombraWhats.position.set(posWhats.x, posWhats.y - 0.012, 0.0015);
  grupoHomeIcones.add(sombraWhats);

  // Onda de luz circular emitida no toque do WhatsApp.
  const matOndaLuz = new THREE.MeshBasicMaterial({
    map: criarTexturaOndaLuz(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ondaLuz = new THREE.Mesh(
    new THREE.PlaneGeometry(tamIcone3D * 2.2, tamIcone3D * 2.2),
    matOndaLuz
  );
  ondaLuz.position.set(posWhats.x, posWhats.y, 0.04);
  grupoHomeIcones.add(ondaLuz);

  // Logo 3D da Gerencia AI montada no topo da conversa.
  const posLogo = canvasParaTela(LOGO_CX, LOGO_CY);
  const grupoLogo = new THREE.Group();
  grupoLogo.position.set(posLogo.x, posLogo.y, TELA_Z + 0.002);
  grupoLogo.visible = false;
  grupoLogo.add(logoGerencia);
  grupoCelular.add(grupoLogo);

  const matSombraLogo = new THREE.MeshBasicMaterial({
    map: criarTexturaSombraRadial(0.58),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sombraLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(raioLogo3D * 2.8, raioLogo3D * 2.8),
    matSombraLogo
  );
  sombraLogo.position.set(posLogo.x, posLogo.y - 0.01, TELA_Z + 0.0015);
  sombraLogo.visible = false;
  grupoCelular.add(sombraLogo);

  // Insere o canvas no palco (atrás da frase e dos cartões HTML).
  palco.prepend(canvas);

  // Métricas de câmera recalculadas a cada redimensionamento do palco.
  let larguraPalco = Math.max(palco.clientWidth, 320);
  let alturaPalco = Math.max(palco.clientHeight, 320);
  let distInteiro = 6.8;
  let distZoomWhats = 2.2;
  let distZoomLogo = 1.95;

  function calcularDistanciasCamera() {
    const aspect = larguraPalco / alturaPalco;
    const fovRad = THREE.MathUtils.degToRad(CAM_FOV_GRAUS);
    const tanV = Math.tan(fovRad / 2);
    const tanH = tanV * aspect;

    // Distância exata para o celular caber inteiro e centralizado em qualquer monitor/zoom.
    const distV = ALTURA_CEL / 2 / (tanV * PREENCHIMENTO_V);
    const distH = LARGURA_CEL / 2 / (tanH * PREENCHIMENTO_H);
    distInteiro = Math.max(distV, distH) + 0.16;

    // Distâncias dos closes (ajustadas tanto à altura quanto à largura para caber no celular).
    const zWhatsV = 0.56 / tanV;
    const zWhatsH = 0.52 / tanH;
    distZoomWhats = Math.max(zWhatsV, zWhatsH) + TELA_Z + 0.18;

    const zLogoV = 0.46 / tanV;
    const zLogoH = 0.56 / tanH;
    distZoomLogo = Math.max(zLogoV, zLogoH) + TELA_Z + 0.16;
  }

  function redimensionar() {
    larguraPalco = Math.max(palco.clientWidth, 320);
    alturaPalco = Math.max(palco.clientHeight, 320);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(larguraPalco, alturaPalco, false);
    camera.aspect = larguraPalco / alturaPalco;
    camera.updateProjectionMatrix();
    calcularDistanciasCamera();
  }

  redimensionar();

  let observadorTamanho = null;
  let ultimoTempoMs = 0;
  let destruido = false;

  const alvoCam = new THREE.Vector3(0, 0, 0);
  const posCam = new THREE.Vector3(0, 0, distInteiro);
  const alvoWhats = new THREE.Vector3(posWhats.x, posWhats.y, TELA_Z + 0.08);
  const alvoLogo = new THREE.Vector3(posLogo.x + 0.19, posLogo.y - 0.01, TELA_Z + 0.06);

  // Atualiza todas as posições 3D, câmera e canvas da tela para um dado instante da linha do tempo.
  function renderizarNoTempo(tempoMs) {
    if (destruido) return;
    ultimoTempoMs = tempoMs;
    ondaLuz.visible = false; // só volta a aparecer na janela do toque (evita anel solto no recomeço)

    // 1. 0 a 3,2 s: somente a frase HTML; celular escondido.
    if (tempoMs < 3200) {
      grupoCelular.visible = false;
      sombraChao.visible = false;
      renderer.render(cena, camera);
      return;
    }

    grupoCelular.visible = true;
    sombraChao.visible = true;

    // ---- Pose do celular (posição e rotação) ----
    let celX = 0;
    let celY = 0;
    let celZ = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    if (tempoMs < 4800) {
      // 2. 3,2 a 4,8 s: surge de baixo e de trás girando (mostra traseira, câmera, lateral e botões).
      const t = easeInOutCubic(faixa(tempoMs, 3200, 4800));
      celY = misturar(-2.2, 0, t);
      celZ = misturar(-1.8, 0, t);
      rotY = misturar(-3.55, -0.36, t);
      rotX = misturar(0.32, 0.12, t);
      rotZ = misturar(0.12, 0.035, t);
    } else if (tempoMs < 6000) {
      // 3. 4,8 a 6,0 s: vira suavemente de frente enquanto a câmera aproxima da tela.
      const t = easeInOutCubic(faixa(tempoMs, 4800, 6000));
      rotY = misturar(-0.36, -0.07, t);
      rotX = misturar(0.12, 0.04, t);
      rotZ = misturar(0.035, 0, t);
    } else if (tempoMs < 6500) {
      // 4. 6,0 a 6,5 s: estável para o toque no WhatsApp.
      rotY = -0.07;
      rotX = 0.04;
    } else if (tempoMs < 7300) {
      // 5. 6,5 a 7,3 s: levemente inclinado para valorizar a extrusão 3D da logo Gerencia AI.
      const t = easeInOutCubic(faixa(tempoMs, 6500, 7300));
      rotY = misturar(-0.07, 0.12, t);
      rotX = misturar(0.04, 0.03, t);
    } else if (tempoMs < 8300) {
      // 6. 7,3 a 8,3 s: segura na logo com paralaxe suave.
      const t = faixa(tempoMs, 7300, 8300);
      const onda = Math.sin(t * Math.PI);
      rotY = 0.12 + Math.sin(t * Math.PI * 2) * 0.06;
      rotX = 0.03 - onda * 0.035;
    } else if (tempoMs < 9500) {
      // 7. 8,3 a 9,5 s: zoom out para o celular inteiro levemente de lado.
      const t = easeInOutCubic(faixa(tempoMs, 8300, 9500));
      rotY = misturar(0.12, 0.16, t);
      rotX = misturar(0.03, 0.06, t);
      rotZ = misturar(0, -0.015, t);
    } else {
      // 8 e 9. 9,5 s em diante: flutuação contínua e leve, centrado no palco.
      const s = (tempoMs - 9500) / 1000;
      celY = Math.sin(s * 1.15) * 0.045;
      rotY = 0.16 + Math.sin(s * 0.72) * 0.065;
      rotX = 0.06 + Math.cos(s * 0.85) * 0.025;
      rotZ = -0.015 + Math.sin(s * 0.6) * 0.01;
    }

    // Flutuação leve também no fim do surgimento (4,2 a 4,8 s).
    if (tempoMs >= 4200 && tempoMs < 4800) {
      const f = faixa(tempoMs, 4200, 4800);
      celY += Math.sin(f * Math.PI) * 0.02;
    }

    grupoCelular.position.set(celX, celY, celZ);
    grupoCelular.rotation.set(rotX, rotY, rotZ);

    // Sombra suave no chão acompanha entrada e flutuação.
    const visSombra = easeOutCubic(faixa(tempoMs, 3400, 4600));
    const escalaSombra = 1 - celY * 0.12;
    matSombraChao.opacity = visSombra * (0.48 - celY * 0.18);
    sombraChao.scale.set(escalaSombra, escalaSombra, 1);

    // ---- Câmera (zoom no WhatsApp -> desliza para a logo -> zoom out centralizado) ----
    if (tempoMs < 4800) {
      posCam.set(0, 0, distInteiro);
      alvoCam.set(0, 0, 0);
    } else if (tempoMs < 6000) {
      const t = easeInOutCubic(faixa(tempoMs, 4800, 6000));
      posCam.set(
        misturar(0, alvoWhats.x, t),
        misturar(0, alvoWhats.y, t),
        misturar(distInteiro, distZoomWhats, t)
      );
      alvoCam.set(
        misturar(0, alvoWhats.x, t),
        misturar(0, alvoWhats.y, t),
        misturar(0, alvoWhats.z, t)
      );
    } else if (tempoMs < 6500) {
      posCam.set(alvoWhats.x, alvoWhats.y, distZoomWhats);
      alvoCam.copy(alvoWhats);
    } else if (tempoMs < 7300) {
      const t = easeInOutCubic(faixa(tempoMs, 6500, 7300));
      posCam.set(
        misturar(alvoWhats.x, alvoLogo.x, t),
        misturar(alvoWhats.y, alvoLogo.y, t),
        misturar(distZoomWhats, distZoomLogo, t)
      );
      alvoCam.set(
        misturar(alvoWhats.x, alvoLogo.x, t),
        misturar(alvoWhats.y, alvoLogo.y, t),
        misturar(alvoWhats.z, alvoLogo.z, t)
      );
    } else if (tempoMs < 8300) {
      const t = faixa(tempoMs, 7300, 8300);
      const paralaxeX = Math.sin(t * Math.PI * 2) * 0.08;
      const paralaxeY = Math.sin(t * Math.PI) * 0.035;
      posCam.set(alvoLogo.x + paralaxeX, alvoLogo.y + paralaxeY, distZoomLogo);
      alvoCam.copy(alvoLogo);
    } else if (tempoMs < 9500) {
      const t = easeInOutCubic(faixa(tempoMs, 8300, 9500));
      posCam.set(
        misturar(alvoLogo.x, 0, t),
        misturar(alvoLogo.y, 0, t),
        misturar(distZoomLogo, distInteiro, t)
      );
      alvoCam.set(
        misturar(alvoLogo.x, 0, t),
        misturar(alvoLogo.y, 0, t),
        misturar(alvoLogo.z, 0, t)
      );
    } else {
      posCam.set(0, 0, distInteiro);
      alvoCam.set(0, 0, 0);
    }

    camera.position.copy(posCam);
    camera.lookAt(alvoCam);

    // ---- Ícone 3D do WhatsApp: encaixado desde o 1º quadro, levanta no zoom, afunda no toque ----
    const aberturaChat = faixa(tempoMs, 6500, 7250);
    const homeVisivel = aberturaChat < 0.72;
    grupoHomeIcones.visible = homeVisivel;

    if (homeVisivel) {
      const fadeHome = 1 - easeInOutCubic(faixa(tempoMs, 6550, 7050));
      matNeutroClaro.opacity = 0.24 * fadeHome;
      matNeutroMenta.opacity = 0.36 * fadeHome;

      // Elevação do WhatsApp no zoom (5,15 a 5,95 s) e retorno ao abrir o chat (6,5 a 6,85 s).
      let elevWhats = 0;
      let escalaWhats = 1;
      if (tempoMs >= 5150 && tempoMs < 6000) {
        elevWhats = easeOutCubic(faixa(tempoMs, 5150, 5950));
      } else if (tempoMs >= 6000 && tempoMs < 6500) {
        // Toque: afunda e volta.
        const tToque = faixa(tempoMs, 6000, 6500);
        const afundar =
          tToque < 0.45
            ? easeOutCubic(tToque / 0.45)
            : 1 - easeOutCubic((tToque - 0.45) / 0.55);
        elevWhats = 1 - afundar * 0.68;
        escalaWhats = 1 - afundar * 0.1;
      } else if (tempoMs >= 6500) {
        elevWhats = 1 - easeInOutCubic(faixa(tempoMs, 6500, 6850));
        escalaWhats = Math.max(0.001, 1 - easeInOutCubic(faixa(tempoMs, 6600, 6950)));
      }

      iconeWhats.position.set(posWhats.x, posWhats.y, 0.002 + elevWhats * 0.145);
      iconeWhats.rotation.set(-elevWhats * 0.11, elevWhats * 0.16, 0);
      iconeWhats.scale.setScalar(escalaWhats);

      // Sombra do ícone sobre a tela cresce e aparece quando ele levanta.
      matSombraWhats.opacity = elevWhats * 0.48 * fadeHome;
      const escSombraW = 0.92 + elevWhats * 0.32;
      sombraWhats.scale.set(escSombraW, escSombraW, 1);
      sombraWhats.position.set(
        posWhats.x - elevWhats * 0.015,
        posWhats.y - 0.012 - elevWhats * 0.02,
        0.0015
      );

      // Onda de luz saindo do ícone durante o toque (6,12 a 6,68 s).
      const tOnda = faixa(tempoMs, 6120, 6680);
      if (tOnda > 0 && tOnda < 1) {
        ondaLuz.visible = true;
        const eOnda = easeOutCubic(tOnda);
        const escOnda = 0.45 + eOnda * 1.35;
        ondaLuz.scale.set(escOnda, escOnda, 1);
        matOndaLuz.opacity = (1 - eOnda) * 0.95;
      } else {
        ondaLuz.visible = false;
      }
    }

    // ---- Logo 3D da Gerencia AI: aparece com a conversa, levanta no zoom e volta no zoom out ----
    const visLogo = aberturaChat > 0.32;
    grupoLogo.visible = visLogo;
    sombraLogo.visible = visLogo;

    let elevLogo = 0;
    if (visLogo) {
      const entradaLogo = easeOutCubic(faixa(tempoMs, 6750, 7150));
      if (tempoMs >= 6850 && tempoMs < 8300) {
        elevLogo = easeOutCubic(faixa(tempoMs, 6850, 7350));
      } else if (tempoMs >= 8300 && tempoMs < 9450) {
        elevLogo = 1 - easeInOutCubic(faixa(tempoMs, 8300, 9450));
      }

      grupoLogo.position.set(posLogo.x, posLogo.y, TELA_Z + 0.002 + elevLogo * 0.125);
      grupoLogo.rotation.set(-elevLogo * 0.08, -elevLogo * 0.14, 0);
      grupoLogo.scale.setScalar(Math.max(0.001, entradaLogo));

      matSombraLogo.opacity = elevLogo * 0.42;
      const escSombraL = 0.92 + elevLogo * 0.28;
      sombraLogo.scale.set(escSombraL, escSombraL, 1);
      sombraLogo.position.set(
        posLogo.x + elevLogo * 0.012,
        posLogo.y - 0.01 - elevLogo * 0.016,
        TELA_Z + 0.0015
      );
    }

    // ---- Estado da conversa desenhada no canvas 1080x2340 ----
    const inicioDigitar = 9500;
    const fimDigitar = inicioDigitar + PERGUNTA_TEXTO.length * 45;
    const envioPergunta = fimDigitar + 220; // ~11,30 s
    const inicioDigitando = envioPergunta + 350; // ~11,65 s
    const fimDigitando = inicioDigitando + 1500; // ~13,15 s

    let textoDigitando = '';
    if (tempoMs >= inicioDigitar && tempoMs < envioPergunta) {
      const qtd = Math.min(
        PERGUNTA_TEXTO.length,
        Math.floor((tempoMs - inicioDigitar) / 45) + 1
      );
      textoDigitando = PERGUNTA_TEXTO.slice(0, qtd);
    }

    const progressoPergunta = faixa(tempoMs, envioPergunta, envioPergunta + 380);
    const mostrandoDigitando = tempoMs >= inicioDigitando && tempoMs < fimDigitando;
    const faseDigitando = mostrandoDigitando ? ((tempoMs - inicioDigitando) / 1000) % 1 : 0;
    const progressoResposta = faixa(tempoMs, fimDigitando, fimDigitando + 420);

    tela.atualizar({
      aberturaChat,
      textoDigitando,
      progressoPergunta,
      mostrandoDigitando,
      faseDigitando,
      progressoResposta,
      logoElevacao: elevLogo
    });

    renderer.render(cena, camera);
  }

  if ('ResizeObserver' in window) {
    observadorTamanho = new ResizeObserver(() => {
      redimensionar();
      renderizarNoTempo(ultimoTempoMs);
    });
    observadorTamanho.observe(palco);
  } else {
    window.addEventListener('resize', redimensionar);
  }

  // Libera memória da GPU ao desmontar o filme.
  function destruir() {
    if (destruido) return;
    destruido = true;
    if (observadorTamanho) {
      observadorTamanho.disconnect();
      observadorTamanho = null;
    } else {
      window.removeEventListener('resize', redimensionar);
    }

    const geometrias = new Set();
    const materiais = new Set();
    const texturas = new Set();

    cena.traverse((obj) => {
      if (obj.geometry) geometrias.add(obj.geometry);
      if (obj.material) {
        const lista = Array.isArray(obj.material) ? obj.material : [obj.material];
        lista.forEach((mat) => {
          materiais.add(mat);
          if (mat.map) texturas.add(mat.map);
        });
      }
    });

    geometrias.forEach((g) => g.dispose());
    materiais.forEach((m) => m.dispose());
    texturas.forEach((t) => t.dispose());
    alvoAmbiente.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    renderizarNoTempo,
    redimensionar,
    destruir,
    tempos: {
      cartaoConsultaMs: 9500 + PERGUNTA_TEXTO.length * 45 + 570, // ~11,65 s
      cartaoNumerosMs: 9500 + PERGUNTA_TEXTO.length * 45 + 2370, // ~13,45 s
      duracaoLoopMs: 9500 + PERGUNTA_TEXTO.length * 45 + 7370 // ~18,45 s (~5 s parado no final)
    }
  };
}
