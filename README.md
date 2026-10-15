# Preparador de Canecas

Aplicação web para preparar artes de **21 × 9,5 cm** para sublimação em canecas:
carregar imagem → conferir qualidade → enquadrar → espelhar → gerar PNG/PDF → imprimir.

Todo o processamento acontece **no navegador**. Não há servidor de imagens, banco de dados nem login.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script              | O que faz                                      |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                    |
| `npm run build`     | Build de produção (páginas 100% estáticas)     |
| `npm test`          | Testes de medidas, qualidade, enquadramento e PDF |
| `npm run typecheck` | Checagem de tipos                              |
| `npm run lint`      | ESLint                                         |

## Deploy na Vercel

1. Suba o repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório (framework detectado: Next.js).
3. Nenhuma variável de ambiente é necessária. Cada push na branch principal publica uma nova versão.

## Como funciona

- **Enquadramento em medidas físicas** (`src/lib/framing.ts`): zoom e posição são guardados em mm
  relativos à arte. A mesma configuração desenha o preview (a partir de uma cópia reduzida) e o
  arquivo final (a partir da **imagem original**), com uma única reamostragem — sem perda acumulada.
- **Qualidade** (`src/lib/imageQuality.ts`): PPI efetivo = pixels da original por polegada impressa,
  recalculado a cada zoom/modo. ≥ 290 Excelente · 180–289 Aceitável · < 180 Baixa.
- **Marcas de corte (registro)** em todos os arquivos (`src/lib/sheetLayout.ts`): ficam 2 mm fora da
  arte, alinhadas às bordas, e a distância entre elas (21 cm e 9,5 cm) também serve para conferir a escala.
- **PNG**: arte de 2480 × 1122 px com 10 mm de margem para as marcas (imagem total de 2716 × 1358 px) e
  resolução de 300 PPI gravada no arquivo (chunk `pHYs`), para que a impressão saia no tamanho físico correto.
- **PDF** (`pdf-lib`, marcas vetoriais): página de 23 × 11,5 cm com uma arte, ou **A4 paisagem** com 1 ou
  2 artes empilhadas e centralizadas, separadas por 6 mm (um corte desalinhado não pega a arte vizinha).
  Cada linha de corte vertical tem marcas acima, no espaço entre as artes e abaixo. A paisagem deixa
  ~4 cm de cada lado para as marcas — em A4 retrato a arte de 21 cm ocuparia a largura toda. O PDF pede ao
  leitor para imprimir sem "ajustar à página".
- **Margem segura** de 3 mm: só uma camada visual no editor, nunca exportada.

## Novos produtos

As dimensões ficam em presets (`src/lib/constants.ts`). Para outro produto, crie um novo
`ProductPreset` (nome, largura/altura em mm, PPI, margem segura); os componentes não têm medidas fixas.

## Teste físico (obrigatório antes de usar em produção)

Em **Ajuda → Carregar arte de teste** (ou no link da tela inicial) é gerada uma arte com régua e o
texto `TESTE 123 ABC →`.

1. Gere o PDF A4 e imprima em **Tamanho real / Escala 100%**.
2. Meça entre as marcas de 5 e 15 cm da régua: deve dar **10 cm**. Entre as marcas de corte verticais: **21 cm**.
3. O texto deve sair invertido no papel (`← CBA 321 ETSET`) e correto na caneca após a sublimação.

> Na A4 com 2 artes sobram só 7 mm acima e abaixo; ali as marcas encurtam (3 mm, a 1 mm da arte) para
> ficar fora da faixa de ~3 mm que a impressora não imprime. As marcas laterais e as do espaço entre as artes
> ficam sempre no tamanho normal ou próximo dele.
