# Por que nós não entendemos a inteligência artificial (ainda)

Material de apoio da palestra de Adrian Valentim na **IA Conference Brasil 2026**:
interpretabilidade mecanicista, referências e experimentos interativos.

**→ [adrianvalentim.github.io/iacb2026](https://adrianvalentim.github.io/iacb2026/)**

Um site de uma página só, em HTML, CSS e JavaScript, sem build. Cada capítulo segue
um assunto da palestra, com um experimento para mexer e as referências logo abaixo.

## O modelo no navegador

Os capítulos 03, 04 e 15 usam o checkpoint real do
[TinyStories-1M](https://huggingface.co/roneneldan/TinyStories-1M) (Eldan & Li, 2023):
3.745.984 parâmetros, rodando num Web Worker. A implementação em JavaScript
(`js/model/tinystories.js`) foi conferida token a token contra a do `transformers`.
Blocos e normalizações vão em float32 exato; embeddings e posições, em float16
(nenhuma previsão muda por isso).

A direção "ponte" do capítulo 15 é a média das ativações na entrada da camada 3, na
posição de " bridge", em dez frases-molde, menos a mesma média para quinze
substantivos comuns (activation addition, Turner et al., 2023).

## Rodar localmente

```sh
python3 -m http.server 8000
# abrir http://localhost:8000
```

Precisa de um servidor: módulos ES e Web Workers não funcionam abrindo o arquivo direto.
