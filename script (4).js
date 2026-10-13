/* AprovaJá - script.js
   Manipulação de DOM, preventDefault() nos formulários e links, e localStorage
   para manter os dados depois de F5. Sem bibliotecas. */
(function () {
  'use strict';

  const PREFIXO = 'aprovaja:';
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SENSIVEL = /senha|codigo|password/i;
  const RESPOSTA_DEMO = 'Estou em modo de demonstração: sua pergunta ficou salva neste navegador, mas a resposta real da IA ainda será conectada.';

  /* ---------- localStorage com proteção (nunca lança erro no Console) ---------- */
  const guardar = {
    ler(chave, padrao) {
      try {
        const bruto = window.localStorage.getItem(PREFIXO + chave);
        return bruto === null ? padrao : JSON.parse(bruto);
      } catch (erro) {
        return padrao;
      }
    },
    gravar(chave, valor) {
      try {
        window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
        return true;
      } catch (erro) {
        return false;
      }
    },
    apagar(chave) {
      try {
        window.localStorage.removeItem(PREFIXO + chave);
      } catch (erro) {
        /* armazenamento indisponível: nada a apagar */
      }
    },
    limparTudo() {
      try {
        Object.keys(window.localStorage)
          .filter((chave) => chave.indexOf(PREFIXO) === 0)
          .forEach((chave) => window.localStorage.removeItem(chave));
        window.sessionStorage.clear();
      } catch (erro) {
        /* armazenamento indisponível: nada a apagar */
      }
    }
  };

  /* ---------- utilitários de DOM ---------- */
  const $ = (seletor, raiz) => (raiz || document).querySelector(seletor);
  const $$ = (seletor, raiz) => Array.from((raiz || document).querySelectorAll(seletor));
  const pagina = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const avisos = new WeakMap();

  const normalizar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const campoDe = (form, nome) => form.elements.namedItem(nome);
  const valorDe = (form, nome) => {
    const campo = campoDe(form, nome);
    return campo && 'value' in campo ? String(campo.value).trim() : '';
  };
  const brutoDe = (form, nome) => {
    const campo = campoDe(form, nome);
    return campo && 'value' in campo ? String(campo.value) : '';
  };
  const marcadoEm = (form, nome) => {
    const campo = campoDe(form, nome);
    return Boolean(campo && campo.checked);
  };

  function irPara(destino, atraso) {
    window.setTimeout(() => {
      window.location.href = destino;
    }, atraso === undefined ? 700 : atraso);
  }

  function avisar(form, texto, tipo) {
    let aviso = avisos.get(form);
    if (!aviso || !aviso.isConnected) {
      aviso = document.createElement('p');
      aviso.className = 'aviso';
      form.parentNode.insertBefore(aviso, form);
      avisos.set(form, aviso);
    }
    aviso.textContent = texto;
    aviso.classList.toggle('aviso-erro', tipo === 'erro');
    aviso.classList.toggle('aviso-ok', tipo !== 'erro');
    aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  }

  function limparAviso(form) {
    const aviso = avisos.get(form);
    if (aviso) {
      aviso.remove();
      avisos.delete(form);
    }
  }

  /* regras: [{ campo, ok, msg }]. Mostra o primeiro erro, marca o campo e devolve true/false. */
  function validar(form, regras) {
    $$('.campo-invalido', form).forEach((campo) => {
      campo.classList.remove('campo-invalido');
      campo.removeAttribute('aria-invalid');
    });
    const falhas = regras.filter((regra) => regra.campo && !regra.ok);
    falhas.forEach((regra) => {
      regra.campo.classList.add('campo-invalido');
      regra.campo.setAttribute('aria-invalid', 'true');
    });
    if (falhas.length) {
      avisar(form, falhas[0].msg, 'erro');
      falhas[0].campo.focus();
      return false;
    }
    limparAviso(form);
    return true;
  }

  /* ---------- rascunho: o que foi digitado sobrevive ao F5 (senhas e códigos nunca são guardados) ---------- */
  function lerCampos(form) {
    const dados = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name || SENSIVEL.test(el.name) || ['password', 'file', 'submit', 'button'].indexOf(el.type) !== -1) return;
      if (el.type === 'checkbox') dados[el.name + ':' + el.value] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) dados[el.name] = el.value;
      } else dados[el.name] = el.value;
    });
    return dados;
  }

  function preencherCampos(form, dados) {
    Array.from(form.elements).forEach((el) => {
      if (!el.name || SENSIVEL.test(el.name) || ['password', 'file', 'submit', 'button'].indexOf(el.type) !== -1) return;
      if (el.type === 'checkbox') {
        const chave = el.name + ':' + el.value;
        if (chave in dados) el.checked = Boolean(dados[chave]);
      } else if (el.type === 'radio') {
        if (el.name in dados) el.checked = dados[el.name] === el.value;
      } else if (el.name in dados) el.value = dados[el.name];
    });
  }

  function manterRascunho(form, chave) {
    form.noValidate = true;
    preencherCampos(form, guardar.ler(chave, {}));
    const salvar = () => guardar.gravar(chave, lerCampos(form));
    form.addEventListener('input', salvar);
    form.addEventListener('change', salvar);
    return () => guardar.apagar(chave);
  }

  /* ---------- itens comuns a todas as páginas ---------- */
  function aplicarUsuario() {
    const usuario = guardar.ler('usuario', null);
    if (!usuario) return;
    const nome = $('.usuario-dados strong');
    const ano = $('.usuario-dados small');
    const avatar = $('.usuario .avatar');
    if (usuario.nome) {
      if (nome) nome.textContent = usuario.nome.split(' ')[0];
      if (avatar) avatar.textContent = usuario.nome.charAt(0).toUpperCase();
    }
    if (ano && usuario.ano) ano.textContent = usuario.ano.split(',')[0];
  }

  function persistirMenu() {
    const caixa = $('#menu');
    if (!caixa) return;
    const grande = window.matchMedia ? window.matchMedia('(min-width: 761px)') : { matches: true };
    if (grande.matches && guardar.ler('menuAberto', false)) caixa.checked = true;
    caixa.addEventListener('change', () => {
      if (grande.matches) guardar.gravar('menuAberto', caixa.checked);
    });
  }

  function ligarSair() {
    $$('a[href="login.html"]').forEach((link) => {
      if (!link.closest('.lateral') && !link.classList.contains('botao-perigo')) return;
      link.addEventListener('click', () => guardar.apagar('sessao'));
    });
  }

  /* ---------- acesso: login, cadastro, recuperar senha ---------- */
  function paginaLogin() {
    const form = $('main form');
    if (!form) return;
    const limparRascunho = manterRascunho(form, 'rascunho:login');
    const usuario = guardar.ler('usuario', null);
    const email = campoDe(form, 'email');
    if (email && !email.value && usuario && usuario.email) email.value = usuario.email;
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const dados = valorDe(form, 'email');
      const ok = validar(form, [
        { campo: campoDe(form, 'email'), ok: EMAIL.test(dados), msg: 'Digite um e-mail válido, como nome@email.com.' },
        { campo: campoDe(form, 'senha'), ok: brutoDe(form, 'senha').length > 0, msg: 'Digite sua senha.' }
      ]);
      if (!ok) return;
      guardar.gravar('sessao', { email: dados, lembrar: marcadoEm(form, 'lembrar'), entrouEm: new Date().toISOString() });
      guardar.gravar('usuario', Object.assign({}, usuario || {}, { email: dados }));
      limparRascunho();
      avisar(form, 'Entrando…', 'ok');
      irPara('index.html');
    });
  }

  function paginaCadastro() {
    const form = $('main form');
    if (!form) return;
    const limparRascunho = manterRascunho(form, 'rascunho:cadastro');
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const email = valorDe(form, 'email');
      const nome = valorDe(form, 'nome');
      const senha = brutoDe(form, 'senha');
      const ok = validar(form, [
        { campo: campoDe(form, 'email'), ok: EMAIL.test(email), msg: 'Digite um e-mail válido, como nome@email.com.' },
        { campo: campoDe(form, 'nome'), ok: nome.length >= 2, msg: 'Digite seu nome (mínimo de 2 letras).' },
        { campo: campoDe(form, 'senha'), ok: senha.length >= 8, msg: 'A senha precisa ter pelo menos 8 caracteres.' },
        { campo: campoDe(form, 'senha2'), ok: brutoDe(form, 'senha2') === senha, msg: 'As duas senhas precisam ser iguais.' },
        { campo: campoDe(form, 'termos'), ok: marcadoEm(form, 'termos'), msg: 'Aceite os termos de uso para continuar.' }
      ]);
      if (!ok) return;
      guardar.gravar('usuario', { nome, email, ano: valorDe(form, 'ano') });
      limparRascunho();
      avisar(form, 'Conta criada! Vamos montar seu plano.', 'ok');
      irPara('boas-vindas.html');
    });
  }

  function paginaRecuperar() {
    const form = $('main form');
    if (!form) return;
    manterRascunho(form, 'rascunho:recuperar');
    const email = campoDe(form, 'email');
    const codigo = campoDe(form, 'codigo');
    const reenviar = $('a.botao-neutro', form);
    const pedido = guardar.ler('recuperacao', null);
    if (email && !email.value && pedido && pedido.email) email.value = pedido.email;

    function enviarCodigo(prefixo) {
      const endereco = valorDe(form, 'email');
      if (!validar(form, [{ campo: email, ok: EMAIL.test(endereco), msg: 'Digite o e-mail cadastrado para receber o código.' }])) return;
      guardar.gravar('recuperacao', { email: endereco, enviadoEm: new Date().toISOString() });
      avisar(form, prefixo + endereco + '. (Demonstração: nenhum e-mail real é enviado; qualquer código de 6 dígitos vale.)', 'ok');
    }

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      enviarCodigo('Código enviado para ');
    });
    if (reenviar) {
      reenviar.addEventListener('click', (evento) => {
        evento.preventDefault();
        enviarCodigo('Código reenviado para ');
      });
    }
    if (codigo) {
      codigo.addEventListener('input', () => {
        codigo.value = codigo.value.replace(/\D/g, '').slice(0, 6);
        if (codigo.value.length < 6) return;
        if (guardar.ler('recuperacao', null)) {
          avisar(form, 'Código aceito. Vamos definir a nova senha.', 'ok');
          irPara('nova-senha.html');
        } else {
          validar(form, [{ campo: codigo, ok: false, msg: 'Peça o código por e-mail antes de digitá-lo.' }]);
        }
      });
    }
  }

  function paginaNovaSenha() {
    const form = $('main form');
    if (!form) return;
    form.noValidate = true;
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const senha = brutoDe(form, 'senha');
      const ok = validar(form, [
        { campo: campoDe(form, 'senha'), ok: senha.length >= 8, msg: 'A nova senha precisa ter pelo menos 8 caracteres.' },
        { campo: campoDe(form, 'senha2'), ok: brutoDe(form, 'senha2') === senha, msg: 'As duas senhas precisam ser iguais.' }
      ]);
      if (!ok) return;
      guardar.apagar('recuperacao');
      avisar(form, 'Senha alterada. Faça login com a nova senha.', 'ok');
      irPara('login.html');
    });
  }

  function paginaBoasVindas() {
    const usuario = guardar.ler('usuario', null);
    const titulo = $('.cartao-acesso h1');
    if (titulo && usuario && usuario.nome) titulo.textContent = 'Olá, ' + usuario.nome.split(' ')[0] + '! Conta criada';
  }

  /* ---------- perfil ---------- */
  function paginaPerfil() {
    const form = $('main form');
    if (!form) return;
    form.noValidate = true;
    const usuario = guardar.ler('usuario', {});
    ['nome', 'ano', 'email'].forEach((nome) => {
      const campo = campoDe(form, nome);
      if (campo && usuario[nome]) campo.value = usuario[nome];
    });
    const lembretes = campoDe(form, 'lembretes');
    if (lembretes) lembretes.checked = usuario.lembretes !== false;

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const nome = valorDe(form, 'nome');
      const email = valorDe(form, 'email');
      const senha = brutoDe(form, 'senha');
      const ok = validar(form, [
        { campo: campoDe(form, 'nome'), ok: nome.length >= 2, msg: 'Digite seu nome (mínimo de 2 letras).' },
        { campo: campoDe(form, 'email'), ok: EMAIL.test(email), msg: 'Digite um e-mail válido, como nome@email.com.' },
        { campo: campoDe(form, 'senha'), ok: senha === '' || senha.length >= 8, msg: 'A nova senha precisa ter pelo menos 8 caracteres.' }
      ]);
      if (!ok) return;
      guardar.gravar('usuario', Object.assign({}, usuario, { nome, email, ano: valorDe(form, 'ano'), lembretes: marcadoEm(form, 'lembretes') }));
      const campoSenha = campoDe(form, 'senha');
      if (campoSenha) campoSenha.value = '';
      aplicarUsuario();
      avisar(form, 'Alterações salvas.', 'ok');
    });

    const caixa = $('.foto-perfil');
    if (!caixa) return;
    const mostrarFoto = () => {
      const antiga = $('img', caixa);
      if (antiga) antiga.remove();
      const foto = guardar.ler('foto', null);
      if (!foto) return;
      const imagem = document.createElement('img');
      imagem.src = foto;
      imagem.alt = 'Foto de perfil';
      caixa.insertBefore(imagem, caixa.firstChild);
    };
    mostrarFoto();

    const carregar = $('.botao-neutro', caixa);
    const remover = $('.botao-perigo', caixa);
    if (carregar) {
      carregar.addEventListener('click', (evento) => {
        evento.preventDefault();
        const seletor = document.createElement('input');
        seletor.type = 'file';
        seletor.accept = 'image/png,image/jpeg,image/webp';
        seletor.addEventListener('change', () => {
          const arquivo = seletor.files && seletor.files[0];
          if (!arquivo) return;
          if (arquivo.size > 300 * 1024) {
            avisar(form, 'Escolha uma imagem de até 300 KB.', 'erro');
            return;
          }
          const leitor = new FileReader();
          leitor.addEventListener('load', () => {
            if (guardar.gravar('foto', leitor.result)) {
              mostrarFoto();
              avisar(form, 'Foto atualizada.', 'ok');
            } else {
              avisar(form, 'Não foi possível guardar a imagem neste navegador.', 'erro');
            }
          });
          leitor.readAsDataURL(arquivo);
        });
        seletor.click();
      });
    }
    if (remover) {
      remover.addEventListener('click', (evento) => {
        evento.preventDefault();
        guardar.apagar('foto');
        mostrarFoto();
        avisar(form, 'Foto removida.', 'ok');
      });
    }
  }

  function paginaExcluirConta() {
    const form = $('main form');
    if (!form) return;
    form.noValidate = true;
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const ok = validar(form, [
        { campo: campoDe(form, 'senha'), ok: brutoDe(form, 'senha').length > 0, msg: 'Digite sua senha para confirmar.' },
        { campo: campoDe(form, 'ciente'), ok: marcadoEm(form, 'ciente'), msg: 'Marque a caixa para confirmar que entende.' }
      ]);
      if (!ok) return;
      if (!window.confirm('Excluir a conta apaga todos os dados guardados neste navegador. Continuar?')) return;
      guardar.limparTudo();
      avisar(form, 'Conta excluída. Até a próxima!', 'ok');
      irPara('login.html', 900);
    });
  }

  /* ---------- planos de estudo ---------- */
  function hojeISO() {
    const agora = new Date();
    return agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
  }

  function paginaEstudar() {
    const titulo = $('main h2');
    const ativo = guardar.ler('planoAtivo', null);
    if (titulo && ativo && ativo.nome) {
      titulo.textContent = 'Plano selecionado: ' + ativo.nome + (ativo.ano ? ', ' + ativo.ano : '');
    }
  }

  function paginaNovoPlano() {
    const form = $('main form');
    if (!form) return;
    const limparRascunho = manterRascunho(form, 'rascunho:novo-plano');
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const nome = valorDe(form, 'nome');
      const prova = valorDe(form, 'prova');
      const materias = $$('input[name="m"]:checked', form).map((caixa) => caixa.parentElement.textContent.trim());
      const ok = validar(form, [
        { campo: campoDe(form, 'nome'), ok: nome.length >= 3, msg: 'Dê um nome ao plano (mínimo de 3 letras).' },
        { campo: $('input[name="m"]', form), ok: materias.length > 0, msg: 'Escolha pelo menos uma matéria.' },
        { campo: campoDe(form, 'prova'), ok: prova === '' || prova >= hojeISO(), msg: 'A data da prova não pode ficar no passado.' }
      ]);
      if (!ok) return;
      const plano = { id: Date.now(), nome, ano: valorDe(form, 'ano'), objetivo: valorDe(form, 'objetivo'), tempo: valorDe(form, 'tempo'), materias, prova };
      const planos = guardar.ler('planos', []);
      planos.push(plano);
      guardar.gravar('planos', planos);
      guardar.gravar('planoAtivo', { nome: plano.nome, ano: plano.ano });
      limparRascunho();
      avisar(form, 'Plano criado e selecionado!', 'ok');
      irPara('estudar.html');
    });
  }

  function descreverPlano(plano) {
    const partes = [plano.materias.length + (plano.materias.length === 1 ? ' matéria' : ' matérias'), plano.tempo + ' por dia', plano.ano];
    if (plano.prova) partes.push('prova em ' + plano.prova.split('-').reverse().join('/'));
    return partes.join(' · ');
  }

  function paginaPlanos() {
    const lista = $('.lista-cartoes');
    if (!lista) return;
    const usar = (nome, ano) => {
      guardar.gravar('planoAtivo', { nome, ano });
      irPara('estudar.html', 0);
    };

    $$('.cartao a.botao-principal', lista).forEach((link) => {
      link.addEventListener('click', (evento) => {
        evento.preventDefault();
        const titulo = $('strong', link.closest('.cartao'));
        usar(titulo ? titulo.textContent : 'Plano', '');
      });
    });

    function criarCartao(plano) {
      const cartao = document.createElement('div');
      cartao.className = 'cartao';
      const titulo = document.createElement('strong');
      titulo.textContent = plano.nome;
      const detalhe = document.createElement('small');
      detalhe.textContent = descreverPlano(plano);
      const acoes = document.createElement('div');
      acoes.className = 'linha-botoes acoes-cartao';
      const botaoUsar = document.createElement('a');
      botaoUsar.className = 'botao botao-principal botao-pequeno';
      botaoUsar.href = 'estudar.html';
      botaoUsar.textContent = 'Usar este plano';
      botaoUsar.addEventListener('click', (evento) => {
        evento.preventDefault();
        usar(plano.nome, plano.ano);
      });
      const botaoExcluir = document.createElement('button');
      botaoExcluir.type = 'button';
      botaoExcluir.className = 'botao botao-contorno botao-pequeno';
      botaoExcluir.textContent = 'Excluir';
      botaoExcluir.addEventListener('click', () => {
        guardar.gravar('planos', guardar.ler('planos', []).filter((item) => item.id !== plano.id));
        const ativo = guardar.ler('planoAtivo', null);
        if (ativo && ativo.nome === plano.nome) guardar.apagar('planoAtivo');
        cartao.remove();
      });
      acoes.append(botaoUsar, botaoExcluir);
      cartao.append(titulo, detalhe, acoes);
      return cartao;
    }

    guardar.ler('planos', []).forEach((plano) => lista.insertBefore(criarCartao(plano), lista.firstChild));
  }

  /* ---------- exercícios ---------- */
  const QUESTOES = [
    {
      enunciado: 'Uma rampa de acesso forma um ângulo de 30° com o chão e tem 12 metros de comprimento. Considerando que o terreno é plano, qual é a altura atingida pela rampa em relação ao ponto de partida?',
      dica: 'Use as relações do triângulo retângulo e lembre que o seno de 30° vale 0,5.',
      opcoes: ['3 metros', '6 metros', '6√3 metros', '12 metros'],
      correta: 1,
      explicacao: 'A rampa é a hipotenusa e a altura é o cateto oposto: sen 30° = altura ÷ 12, então altura = 0,5 × 12 = 6 metros.'
    },
    {
      enunciado: 'Em um triângulo retângulo, a hipotenusa mede 10 cm e o cateto adjacente ao ângulo α mede 5 cm. Qual é o valor de α?',
      dica: 'Lembre que cosseno = cateto adjacente ÷ hipotenusa.',
      opcoes: ['30°', '45°', '60°', '90°'],
      correta: 2,
      explicacao: 'cos α = 5 ÷ 10 = 0,5, e o ângulo agudo cujo cosseno vale 0,5 é 60°.'
    },
    {
      enunciado: 'Qual é o valor da tangente de 45°?',
      dica: '',
      opcoes: ['0', '1/2', '1', '√3'],
      correta: 2,
      explicacao: 'Em um triângulo retângulo com ângulo de 45°, os dois catetos têm o mesmo tamanho. Como tg = cateto oposto ÷ cateto adjacente, o resultado é 1.'
    },
    {
      enunciado: 'Uma escada de 8 metros está apoiada em uma parede e forma 60° com o chão. A que altura da parede a escada encosta?',
      dica: 'O seno de 60° vale √3/2 (aproximadamente 0,87).',
      opcoes: ['4 metros', '4√3 metros', '8 metros', '8√3 metros'],
      correta: 1,
      explicacao: 'A altura é o cateto oposto ao ângulo de 60°: sen 60° = altura ÷ 8, então altura = 8 × √3/2 = 4√3 metros (cerca de 6,9 m).'
    },
    {
      enunciado: 'Qual relação é verdadeira para qualquer ângulo agudo α?',
      dica: '',
      opcoes: ['sen α + cos α = 1', 'sen² α + cos² α = 1', 'sen α = cos α', 'tg α = sen α × cos α'],
      correta: 1,
      explicacao: 'É a relação fundamental da trigonometria, que vem do teorema de Pitágoras: sen² α + cos² α = 1. (A tangente é sen α ÷ cos α, e não o produto.)'
    }
  ];

  function paginaExercicios() {
    const titulo = $('.painel h2');
    const enunciados = $$('.painel .enunciado');
    const opcoes = $$('.alternativa');
    const caixa = $('#resposta .resposta');
    const verResposta = $('#resposta a.botao-principal');
    const proxima = $('.painel-exercicio .linha-botoes a.botao-principal');
    const contador = $('.progresso-exercicio span:last-child');
    const barra = $('.barra-cheia');
    if (!titulo || !opcoes.length || !caixa || !verResposta || !proxima || !contador || !barra) return;

    const total = QUESTOES.length;
    let estado = guardar.ler('exercicios', null);
    if (!estado || typeof estado.indice !== 'number' || !Array.isArray(estado.respostas)) {
      estado = { indice: 0, respostas: [], finalizado: false };
    }
    estado.indice = Math.min(Math.max(0, Math.trunc(estado.indice)), total - 1);
    const salvar = () => guardar.gravar('exercicios', estado);
    const respostaAtual = () => {
      if (!estado.respostas[estado.indice]) estado.respostas[estado.indice] = { escolha: null, revelada: false };
      return estado.respostas[estado.indice];
    };
    const acertos = () => QUESTOES.filter((q, i) => estado.respostas[i] && estado.respostas[i].escolha === q.correta).length;

    function mostrarCaixa(questao, resposta, aviso) {
      const destaque = document.createElement('strong');
      const texto = document.createElement('p');
      caixa.classList.remove('certo', 'errado');
      if (estado.finalizado) {
        destaque.textContent = 'Fim do bloco!';
        texto.textContent = 'Você acertou ' + acertos() + ' de ' + total + ' questões. Toque em Recomeçar para tentar de novo.';
      } else if (resposta.revelada) {
        const acertou = resposta.escolha === questao.correta;
        caixa.classList.add(acertou ? 'certo' : 'errado');
        destaque.textContent = acertou ? 'Você acertou!' : 'Resposta correta: ' + questao.opcoes[questao.correta];
        texto.textContent = questao.explicacao;
      } else {
        texto.textContent = aviso || 'A explicação da questão aparece aqui depois de responder.';
      }
      caixa.replaceChildren(...(destaque.textContent ? [destaque, texto] : [texto]));
    }

    function desenhar() {
      const questao = QUESTOES[estado.indice];
      const resposta = respostaAtual();
      titulo.textContent = 'Questão ' + (estado.indice + 1);
      enunciados.forEach((paragrafo, i) => {
        const texto = i === 0 ? questao.enunciado : questao.dica;
        paragrafo.textContent = texto || '';
        paragrafo.hidden = !texto;
      });
      opcoes.forEach((opcao, i) => {
        const texto = questao.opcoes[i];
        opcao.hidden = texto === undefined;
        opcao.textContent = texto || '';
        opcao.setAttribute('role', 'button');
        opcao.setAttribute('aria-pressed', String(resposta.escolha === i));
        opcao.classList.toggle('selecionada', resposta.escolha === i && !resposta.revelada);
        opcao.classList.toggle('correta', resposta.revelada && i === questao.correta);
        opcao.classList.toggle('errada', resposta.revelada && resposta.escolha === i && i !== questao.correta);
      });
      contador.textContent = 'Questão ' + (estado.indice + 1) + ' de ' + total;
      barra.style.width = ((estado.indice + 1) / total) * 100 + '%';
      proxima.textContent = estado.finalizado ? 'Recomeçar' : estado.indice === total - 1 ? 'Finalizar' : 'Próxima questão';
      mostrarCaixa(questao, resposta);
    }

    opcoes.forEach((opcao, i) => {
      opcao.addEventListener('click', (evento) => {
        evento.preventDefault();
        const resposta = respostaAtual();
        if (resposta.revelada || estado.finalizado) return;
        resposta.escolha = i;
        salvar();
        desenhar();
      });
    });

    verResposta.addEventListener('click', (evento) => {
      evento.preventDefault();
      const resposta = respostaAtual();
      if (resposta.escolha === null) {
        mostrarCaixa(QUESTOES[estado.indice], resposta, 'Escolha uma alternativa antes de ver a resposta.');
        return;
      }
      resposta.revelada = true;
      salvar();
      desenhar();
    });

    proxima.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (estado.finalizado) estado = { indice: 0, respostas: [], finalizado: false };
      else if (estado.indice < total - 1) estado.indice += 1;
      else estado.finalizado = true;
      salvar();
      desenhar();
    });

    desenhar();
  }

  /* ---------- assistente de IA ---------- */
  function paginaIa() {
    const form = $('.caixa-pergunta');
    const campo = form ? $('textarea', form) : null;
    if (!form || !campo) return;
    const limparRascunho = manterRascunho(form, 'rascunho:ia');
    let historico = guardar.ler('conversa', []);
    if (!Array.isArray(historico)) historico = [];

    const conversa = document.createElement('div');
    conversa.className = 'conversa';
    conversa.setAttribute('aria-live', 'polite');
    form.parentNode.insertBefore(conversa, form);
    const botaoLimpar = document.createElement('button');
    botaoLimpar.type = 'button';
    botaoLimpar.className = 'botao botao-neutro botao-pequeno limpar-conversa';
    botaoLimpar.textContent = 'Limpar conversa';
    form.insertAdjacentElement('afterend', botaoLimpar);

    function desenhar() {
      conversa.replaceChildren(
        ...historico.map((mensagem) => {
          const balao = document.createElement('div');
          balao.className = 'balao ' + (mensagem.papel === 'usuario' ? 'balao-usuario' : 'balao-ia');
          const texto = document.createElement('p');
          texto.textContent = String(mensagem.texto);
          balao.appendChild(texto);
          return balao;
        })
      );
      botaoLimpar.hidden = historico.length === 0;
    }

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const pergunta = campo.value.trim();
      if (!validar(form, [{ campo, ok: pergunta.length > 0, msg: 'Escreva sua pergunta antes de enviar.' }])) return;
      historico.push({ papel: 'usuario', texto: pergunta }, { papel: 'ia', texto: RESPOSTA_DEMO });
      historico = historico.slice(-40);
      guardar.gravar('conversa', historico);
      campo.value = '';
      limparRascunho();
      desenhar();
    });

    campo.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter' || evento.shiftKey || evento.isComposing) return;
      evento.preventDefault();
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });

    $$('.sugestao').forEach((sugestao) => {
      sugestao.addEventListener('click', (evento) => {
        evento.preventDefault();
        campo.value = sugestao.textContent.trim();
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.focus();
      });
    });

    botaoLimpar.addEventListener('click', () => {
      historico = [];
      guardar.apagar('conversa');
      desenhar();
    });

    desenhar();
  }

  /* ---------- ajuda e contato ---------- */
  function paginaAjuda() {
    const busca = $('input[type="search"]');
    const lista = $('.lista-cartoes');
    if (!busca || !lista) return;
    const cartoes = $$('.cartao', lista);
    const vazio = document.createElement('p');
    vazio.className = 'dica';
    vazio.hidden = true;
    vazio.textContent = 'Nenhum resultado. Tente outra palavra ou fale com a gente.';
    lista.insertAdjacentElement('afterend', vazio);
    busca.addEventListener('input', () => {
      const termo = normalizar(busca.value.trim());
      let achados = 0;
      cartoes.forEach((cartao) => {
        const mostrar = termo === '' || normalizar(cartao.textContent).indexOf(termo) !== -1;
        cartao.hidden = !mostrar;
        if (mostrar) achados += 1;
      });
      vazio.hidden = achados > 0;
    });
  }

  function paginaSobre() {
    const form = $('#contato form');
    if (!form) return;
    const limparRascunho = manterRascunho(form, 'rascunho:contato');
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const nome = valorDe(form, 'nome');
      const email = valorDe(form, 'email');
      const mensagem = valorDe(form, 'mensagem');
      const ok = validar(form, [
        { campo: campoDe(form, 'nome'), ok: nome.length >= 2, msg: 'Digite seu nome (mínimo de 2 letras).' },
        { campo: campoDe(form, 'email'), ok: EMAIL.test(email), msg: 'Digite um e-mail válido, como nome@email.com.' },
        { campo: campoDe(form, 'mensagem'), ok: mensagem.length >= 10, msg: 'Escreva uma mensagem com pelo menos 10 letras.' }
      ]);
      if (!ok) return;
      const mensagens = guardar.ler('mensagens', []);
      mensagens.push({ nome, email, assunto: valorDe(form, 'assunto'), mensagem, enviadaEm: new Date().toISOString() });
      guardar.gravar('mensagens', mensagens.slice(-20));
      limparRascunho();
      form.reset();
      avisar(form, 'Mensagem salva neste navegador. (Demonstração: ainda não há envio por e-mail.)', 'ok');
    });
  }

  /* ---------- roteador: cada página liga só o que ela usa ---------- */
  const paginas = {
    'login.html': paginaLogin,
    'cadastro.html': paginaCadastro,
    'recuperar-senha.html': paginaRecuperar,
    'nova-senha.html': paginaNovaSenha,
    'boas-vindas.html': paginaBoasVindas,
    'perfil.html': paginaPerfil,
    'excluir-conta.html': paginaExcluirConta,
    'estudar.html': paginaEstudar,
    'novo-plano.html': paginaNovoPlano,
    'planos.html': paginaPlanos,
    'exercicios.html': paginaExercicios,
    'ia.html': paginaIa,
    'ajuda.html': paginaAjuda,
    'sobre.html': paginaSobre
  };

  function iniciar() {
    aplicarUsuario();
    persistirMenu();
    ligarSair();
    const rodar = paginas[pagina];
    if (rodar) rodar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
