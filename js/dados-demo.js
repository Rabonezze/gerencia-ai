/*
  GerencIA: roteiro do modo demonstração.
  Cada cena é uma aba da seção #demo (o atributo data-cena do botão). Os números vêm do mercado.db
  de teste (somente leitura, últimos 30 dias: 22/10 a 20/11/2026) e as frases seguem o jeito real
  do bot responder no WhatsApp. "resposta" pode usar <b> e <br>, nada além disso.
*/
window.GERENCIA_DEMO = {
  cenas: {
    estoque: {
      pergunta: 'O que está com estoque baixo?',
      consulta: 'Lendo o estoque da loja, somente leitura',
      resposta: '5 produtos estão abaixo do mínimo:<br>'
        + '• <b>Café Torrado e Moído 500g</b>: 6 un (mínimo 15)<br>'
        + '• <b>Linguiça Toscana Frescal</b>: 4,2 kg (mínimo 10)<br>'
        + '• <b>Feijão Carioca 1kg</b>: 10 un (mínimo 20)<br>'
        + '• <b>Cerveja Pilsen Lata 350ml</b>: 18 un (mínimo 36)<br>'
        + '• <b>Bolo de Cenoura com Cobertura</b>: 3 un (mínimo 6)'
    },
    faturamento: {
      pergunta: 'Quanto vendi nos últimos 30 dias?',
      consulta: 'Somando as vendas do mês, somente leitura',
      resposta: 'Nos últimos 30 dias o mercado faturou <b>R$ 9.599,98</b> em <b>80 vendas</b>. '
        + 'O lucro total foi de <b>R$ 3.669,78</b>. O melhor dia foi 20/11, com R$ 972,62.'
    },
    vendidos: {
      pergunta: 'Quais foram os produtos mais vendidos?',
      consulta: 'Lendo os itens vendidos, somente leitura',
      resposta: 'Os mais vendidos em reais foram:<br>'
        + '1. <b>Arroz Tipo 1 5kg</b>: R$ 1.345,00<br>'
        + '2. <b>Café Torrado e Moído 500g</b>: R$ 1.014,90<br>'
        + '3. <b>Patinho Bovino Resfriado</b>: R$ 802,98<br>'
        + 'O produto que gerou maior lucro foi o <b>Arroz Tipo 1 5kg</b>, totalizando <b>R$ 420,00</b>.'
    },
    pagamentos: {
      pergunta: 'Como os clientes estão pagando?',
      consulta: 'Agrupando as vendas por pagamento, somente leitura',
      resposta: 'O <b>PIX</b> lidera com <b>R$ 2.911,45</b> (30%). Depois vêm Dinheiro (R$ 2.050,02), '
        + 'Vale Alimentação (R$ 1.910,51), Cartão de Crédito (R$ 1.553,40) e Cartão de Débito (R$ 1.174,60).'
    }
  },

  // tempos da animação, em milissegundos
  tempos: { antesDaConsulta: 400, consulta: 900, digitando: 1100 },

  // modo ao vivo: a API do projeto rodando no seu computador (Docker ou uvicorn)
  api: {
    url: 'http://localhost:8000/perguntar',
    saude: 'http://localhost:8000/health',
    limiteMs: 30000
  }
};
