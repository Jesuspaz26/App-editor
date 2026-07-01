import { Inspiration } from './types';

export const INITIAL_INSPIRATIONS: Inspiration[] = [
  {
    id: '1',
    niche: 'Psicologia Humana',
    classification: 'Masculinidade e Desenvolvimento',
    content: `A vida inteira eu estudei sobre habilidades sociais. Eu sempre achei que o homem que era tímido, inseguro e que não se sentia notado pelas pessoas, o problema dele era introversão ou timidez ou só habilidades sociais. Mas cavando fundo, cara, eu entendi que o que realmente falta nesse homem é energia masculina...`,
    createdAt: Date.now()
  },
  {
    id: '2',
    niche: 'Psicologia Humana',
    classification: 'Poder e Persuasão',
    content: `48 leis do Poder do Robert Green Eu amo Robert Green apesar de ser um autor sem Papas na Língua meio polêmico e um pouco controverso as 48 leis do poder é um livro que todo homem na minha opinião deve ler...`,
    createdAt: Date.now()
  },
  {
    id: '3',
    niche: 'Psicologia Humana',
    classification: 'Vícios e Dopamina',
    content: `Olha esse vídeo ele é muito necessário e você precisa me escutar e eles fizeram uma pesquisa conversaram com as pessoas que ali estavam se divorciando... 98% a presença da pornografia da imoralidade justificava também aquele divórcio...`,
    createdAt: Date.now()
  },
  {
    id: '4',
    niche: 'Marketing e Storytelling',
    classification: 'Conceito Storytelling',
    content: `Storytelling é a capacidade de transmitir conteúdo por meio de enredo elaborado e de uma narrativa envolvente, usando palavras e recursos audiovisuais. A técnica, cujo caráter é persuasivo, ajuda a promover o seu negócio e a vender seus serviços de forma indireta.`,
    createdAt: Date.now()
  }
];

export const NICHES = ['Psicologia Humana', 'Marketing e Storytelling'];
