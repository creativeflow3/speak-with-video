/**
 * Hand-graded answer key for the retrieval eval (retrieval.test.ts).
 *
 * Each case lists every occurrence of the query phrase in the ingested videos,
 * graded:
 *   2 = great example — clear context, natural usage, the phrase is the point
 *   1 = valid but weak — mumbled, cut off, incidental
 *   0 = false hit — substring match, different meaning
 *
 * To add cases, generate candidates with
 *   npm run eval:label -- "vale la pena" "valió la pena"
 * then paste the printed entries here and replace each `grade` with a real one.
 *
 * Aim for 20–30 cases mixing multi-word phrases, single words, conjugated forms,
 * and idioms — including at least 5 phrases found in 2+ videos, and at least 2
 * where one video has many weak occurrences and another has a few strong ones.
 */
import type { LabeledOccurrence } from "@/lib/retrieval-metrics";
import type { SupportedLanguageCode } from "@/lib/languages";

export interface RetrievalCase {
  query: string;
  language?: SupportedLanguageCode;
  relevant: LabeledOccurrence[];
}

export const RETRIEVAL_CASES: RetrievalCase[] = [
  {
    query: "ou seja",
    language: "pt",
    relevant: [
      // How Brazilians React When Things Go Wrong | Learn Portuguese @ 224s: "E no dia lá pelo dia 10 de setembro, a gente finalmente encontrou um apartamento. A gente assinou o contrato. A gente assinou o contrato numa terça-feira. Na quarta-feira, os bancos entraram em greve, ou seja, o meu financiamento, o processo que seria do do mortgage, ah, ele ficou parado até hoje. Hoje nós"
      { videoId: "epkcwbG3IrQ", time: 239.9, grade: 1 },
      // How Brazilians React When Things Go Wrong | Learn Portuguese @ 531s: "para me preparar, eu começo a ler a mensagem e em seguida a mensagem abaixo era: "O seu voo de volta foi cancelado por não comparecer ao primeiro voo. E como assim? >> Oi? Vou [limpando a garganta] é hoje à noite, só que era meianoite:30, ou seja, era 7 horas:30"
      { videoId: "epkcwbG3IrQ", time: 545.1, grade: 1 },
      // How Brazilians React When Things Go Wrong | Learn Portuguese @ 552s: "ou seja, era 7 horas:30 antes do horário que eu acordei, era o mesmo dia. Então, a lição foi sempre comprar um voo, no máximo até 11:30 da noite, nunca depois de meia-noite, 1 da manhã, 2as da manhã, porque pode criar essa confusão com o dia. Pelo menos eu recebi o"
      { videoId: "epkcwbG3IrQ", time: 566, grade: 1 },
      // Let’s Talk About Language Learning ANXIETY While I Make Yogurt :) | REAL INPUT @ 751s: "doente, que eu estou com dor de cabeça. Então, a gente fica criando desculpas, ou seja, a gente pensa em justificativas para não ir ou até mentiras mesmo, né? pra gente não ir e não fazer essa apresentação. Isso é biológico, é uma tentativa de evitar algo que representa um perigo."
      { videoId: "I-a_Gp6IoeY", time: 766.2, grade: 1 },
      // How to Invite Someone Out in Brazilian Portuguese @ 378s: "gosta. >> E é engraçado, porque tem diferentes coisas que podem acontecer. Por exemplo, você chamou alguém para sair e a pessoa disse, eu não posso porque minha amiga vai viajar e eu preciso cuidar do gato dela. Ou seja, é uma desculpa muito específica. Mas você não sabe se"
      { videoId: "JT8w4NTN74A", time: 391.6, grade: 1 },
      // CASA DE PRAIA COM 480 M² @ 163s: "Verde ele é uma textura que é bem resistente ou seja uma uma pintura que vai durar bastante a gente colocou um bancão bem rústico aqui na entrada que serve para chegar apoiar mala bolsa né a gente já tá debaixo de uma área coberta essa porta aqui ela dá acesso à levander"
    ],
  },
];
