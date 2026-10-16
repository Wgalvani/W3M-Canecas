import { formatPresetSize } from "@/lib/measurements";
import { testRulerSpanCm } from "@/lib/testPattern";
import type { ProductPreset } from "@/types/image";
import { Modal } from "./Modal";
import { PrintNotice } from "./PrintNotice";
import { btn } from "./ui";

export function HelpDialog({
  open,
  onClose,
  preset,
  onTestPattern,
}: {
  open: boolean;
  onClose: () => void;
  preset: ProductPreset;
  onTestPattern: () => void;
}) {
  const size = formatPresetSize(preset);
  const [spanFrom, spanTo] = testRulerSpanCm(preset);
  return (
    <Modal open={open} onClose={onClose} title="Como usar">
      <div className="space-y-5 text-sm leading-relaxed text-ink-soft">
        <ol className="space-y-3 [counter-reset:step] [&>li]:relative [&>li]:pl-9 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-0 [&>li]:before:grid [&>li]:before:size-6 [&>li]:before:place-items-center [&>li]:before:rounded-full [&>li]:before:bg-ink [&>li]:before:font-mono [&>li]:before:text-[11px] [&>li]:before:text-paper [&>li]:before:content-[counter(step)] [&_strong]:font-semibold [&_strong]:text-ink">
          <li>
            <strong>Selecione ou arraste</strong> uma imagem JPG, PNG ou WEBP.
          </li>
          <li>
            <strong>Ajuste o enquadramento</strong>: arraste a imagem e use o zoom. <em>Preencher</em> cobre toda a área
            ({size}); <em>Encaixar</em> mostra a imagem inteira com fundo branco.
          </li>
          <li>
            Confira a <strong>qualidade</strong>. Se aparecer “Baixa qualidade”, prefira uma imagem maior.
          </li>
          <li>
            Deixe <strong>Espelhar</strong> ligado — é necessário na sublimação.
          </li>
          <li>
            O <strong>tamanho da arte</strong> pode ser trocado nas configurações, em largura e altura (cm).
          </li>
          <li>
            <strong>Gere o arquivo</strong> (PNG, PDF ou PDF A4) e imprima.
          </li>
        </ol>

        <PrintNotice />

        <p>
          Todos os arquivos saem com <strong>marcas de corte</strong>: corte seguindo as marcas, de ponta a ponta. A
          distância entre elas confere a escala ({size}).
        </p>

        <p>
          A linha tracejada ciano é a <strong>área segura</strong> ({preset.safeMarginMm} mm). Ela aparece só no editor e
          não é impressa. Evite textos e rostos fora dela.
        </p>

        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="font-display text-base font-semibold text-ink">Teste de impressão</p>
          <p className="mt-1">
            Gere a arte de teste ({size}), imprima em escala 100% e meça com régua entre as marcas de {spanFrom} cm e{" "}
            {spanTo} cm: deve dar {spanTo - spanFrom} cm. No arquivo, o texto “TESTE 123 ABC →” deve aparecer invertido.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onTestPattern();
            }}
            className={`mt-3 h-10 px-4 ${btn.secondary}`}
          >
            Carregar arte de teste
          </button>
        </div>

        <p className="flex items-center gap-2 text-muted">
          Suas imagens são processadas localmente, no seu navegador, e não são enviadas nem armazenadas.
        </p>
      </div>
    </Modal>
  );
}
