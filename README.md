# portfolio-apps

Portfólio de Vinícius Pires da Silva, desenvolvedor C# e .NET: a minha mesa em pixel art, onde cada aparelho é um projeto.

**No ar:** https://suiciniv-dev-apps.pages.dev/ (português) e https://suiciniv-dev-apps.pages.dev/en/ (inglês)

![Prévia do portfólio](assets/preview.jpg)

## O que tem na página

- **A mesa**: uma cena em pixel art desenhada num canvas de 320×180. O celular velho com o Racco é o Banditboard, o monitor é o Senna, o segundo monitor é o ControlSensors HUD, o celular com a câmera é o app Símix Ponto e o notebook é o Símix Ponto Cloud. A janela segue a hora e o tempo de Canoas, pela Open-Meteo.
- **Ligar o setup**: a entrada na primeira visita de cada sessão do navegador.
- **Projetos**: Banditboard ([código](https://github.com/suiciniv-dev/banditboard)), Senna, ControlSensors HUD ([código](https://github.com/suiciniv-dev/ControlSensors)), Símix Ponto e Símix Ponto Cloud, cada um com uma demo.
- **Player 1**: o retrato em pixel art, o resumo e o inventário com a stack.
- **Espelho de ponto**: a carreira na Símix, com os projetos do tempo livre.
- **Contato** e o terminal do Senna.
- **16 segredos** espalhados pela mesa, contados na estrela do topo.

## Como editar

É um site estático, sem build:

- `index.html` é a página em português e a fonte de tudo.
- `en/index.html` sai do português com `node scripts/en.mjs`. Ao mudar um texto no `index.html`, atualize o par correspondente em `scripts/en.mjs` e rode o script de novo; se algum trecho ficar sem tradução, ele para e lista qual.
- `assets/site.css` e `assets/site.js` servem às duas páginas. Os textos que o JavaScript escreve ficam no `site.js`, em pares `T('português', 'inglês')`.
- `assets/` guarda também os currículos em PDF (português e inglês), a `preview.jpg` usada nas redes e o favicon.

Para testar: `?pular` abre direto na mesa, sem a entrada, e `?hora=22` força a hora da cena (dia, entardecer e noite). Cada push na `main` é publicado pelo Cloudflare Pages.
