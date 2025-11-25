// Configuração do JSONBin.io
const JSONBIN_CONFIG = {
    BIN_ID: '692502fc43b1c97be9c3356b', // Você vai criar isso no passo 2
    API_KEY: '$2a$10$uMVtnsi.QKY8/xBmNq/9s.pK0D.HWm.w/ofWnpc0eoyCIUhHml4/.', // Você vai criar isso no passo 1
    BASE_URL: 'https://api.jsonbin.io/v3/b'
};

// Elementos DOM
const form = document.getElementById('equipamentoForm');
const nomeInput = document.getElementById('nomeEquip');
const statusSelect = document.getElementById('statusEquip');
const causaInput = document.getElementById('causaParada');
const horaInicioInput = document.getElementById('horaInicio');
const horaFimInput = document.getElementById('horaFim');
const tabelaCorpo = document.querySelector('#relatorioEquip tbody');
const limparBtn = document.getElementById('limparBtn');
const statusConexao = document.getElementById('statusConexao');
const btnAtualizar = document.getElementById('btnAtualizar');
const lastUpdate = document.getElementById('lastUpdate');
const loading = document.getElementById('loading');

let equipamentos = [];
let editandoId = null;
let nextId = 1;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarEquipamentos();
    setupEventListeners();
    startAutoRefresh();
});

function setupEventListeners() {
    limparBtn.addEventListener('click', limparFormulario);
    btnAtualizar.addEventListener('click', carregarEquipamentos);
    
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        await salvarEquipamento();
    });
}

// Funções do JSONBin.io
async function carregarEquipamentos() {
    showLoading(true);
    try {
        const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar dados do JSONBin');

        const data = await response.json();
        equipamentos = data.record?.equipamentos || [];
        
        // Calcular próximo ID
        if (equipamentos.length > 0) {
            nextId = Math.max(...equipamentos.map(e => e.id)) + 1;
        } else {
            nextId = 1;
        }
        
        renderTabela();
        updateConnectionStatus(true);
        updateLastUpdateTime();
        showNotification('Dados carregados com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao carregar equipamentos:', error);
        updateConnectionStatus(false);
        showNotification('Erro ao carregar dados. Verifique a conexão.', 'error');
    } finally {
        showLoading(false);
    }
}

async function salvarNoJSONBin(dados) {
    const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_CONFIG.API_KEY
        },
        body: JSON.stringify({
            equipamentos: dados,
            ultimaAtualizacao: new Date().toISOString()
        })
    });

    if (!response.ok) throw new Error('Erro ao salvar no JSONBin');
    return await response.json();
}

async function salvarEquipamento() {
    const equipamentoData = {
        nome: nomeInput.value.trim(),
        status: statusSelect.value,
        causa: causaInput.value.trim(),
        horaInicio: horaInicioInput.value,
        horaFim: horaFimInput.value,
        dataHoraCadastro: formatDateTime(new Date())
    };

    if (!equipamentoData.nome || !equipamentoData.status) {
        showNotification('Preencha todos os campos obrigatórios!', 'error');
        return;
    }

    showLoading(true);
    try {
        if (editandoId) {
            // Editar equipamento existente
            const index = equipamentos.findIndex(e => e.id === editandoId);
            if (index !== -1) {
                equipamentos[index] = { ...equipamentos[index], ...equipamentoData };
            }
        } else {
            // Criar novo equipamento
            equipamentoData.id = nextId++;
            equipamentos.push(equipamentoData);
        }

        // Salvar no JSONBin
        await salvarNoJSONBin(equipamentos);
        await carregarEquipamentos();
        limparFormulario();
        
        const message = editandoId ? 'Equipamento atualizado com sucesso!' : 'Equipamento cadastrado com sucesso!';
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('Erro ao salvar equipamento:', error);
        showNotification('Erro ao salvar equipamento. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

async function excluirEquipamento(id) {
    if (!confirm('Tem certeza que deseja excluir este equipamento?')) {
        return;
    }

    showLoading(true);
    try {
        // Remover localmente
        equipamentos = equipamentos.filter(e => e.id !== id);
        
        // Salvar no JSONBin
        await salvarNoJSONBin(equipamentos);
        await carregarEquipamentos();
        showNotification('Equipamento excluído com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao excluir equipamento:', error);
        showNotification('Erro ao excluir equipamento. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

// Funções de UI
function renderTabela() {
    tabelaCorpo.innerHTML = '';
    
    if (equipamentos.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align: center; color: #666;">Nenhum equipamento cadastrado</td>`;
        tabelaCorpo.appendChild(tr);
        return;
    }

    equipamentos.forEach((equip) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${escapeHtml(equip.nome)}</td>
            <td class="status-${equip.status}">${equip.status.charAt(0).toUpperCase() + equip.status.slice(1)}</td>
            <td>${escapeHtml(equip.causa || '-')}</td>
            <td>${equip.horaInicio || '-'}</td>
            <td>${equip.horaFim || '-'}</td>
            <td>${equip.dataHoraCadastro || '-'}</td>
            <td>
                <button class="btn editar" onclick="editarEquipamento(${equip.id})">Editar</button>
                <button class="btn excluir" onclick="excluirEquipamento(${equip.id})">Excluir</button>
            </td>
        `;

        tabelaCorpo.appendChild(tr);
    });
}

function editarEquipamento(id) {
    const equip = equipamentos.find(e => e.id === id);
    if (!equip) return;

    nomeInput.value = equip.nome;
    statusSelect.value = equip.status;
    causaInput.value = equip.causa || '';
    horaInicioInput.value = equip.horaInicio || '';
    horaFimInput.value = equip.horaFim || '';
    editandoId = id;
    
    nomeInput.focus();
    showNotification('Editando equipamento...', 'success');
}

function limparFormulario() {
    form.reset();
    editandoId = null;
    nomeInput.focus();
}

function updateConnectionStatus(online) {
    if (online) {
        statusConexao.textContent = '🟢 Online';
        statusConexao.className = 'status-online';
    } else {
        statusConexao.textContent = '🔴 Offline';
        statusConexao.className = 'status-offline';
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    lastUpdate.textContent = now.toLocaleTimeString('pt-BR');
}

function showLoading(show) {
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

function showNotification(message, type) {
    // Remove notificação existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Cria nova notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Mostra a notificação
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove após 5 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Funções utilitárias
function formatDateTime(date) {
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Atualização automática a cada 30 segundos
function startAutoRefresh() {
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            carregarEquipamentos();
        }
    }, 30000); // 30 segundos
}

// Atualizar quando a página ficar visível
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        carregarEquipamentos();
    }
});