'use strict';

const Groups = (() => {
  let selectedUsers = [];
  let currentGroupId = null;

  /* Cargar grupos del usuario */
  async function loadGroups() {
    try {
      const res = await fetch('/api/groups', {
        headers: { 'Authorization': 'Bearer ' + window._session?.token }
      });
      const data = await res.json();
      if (data.ok) {
        renderGroupsList(data.groups);
      }
    } catch (e) {
      console.error('Error al cargar grupos:', e);
    }
  }

  /* Renderizar lista de grupos */
  function renderGroupsList(groups) {
    const container = document.getElementById('groups-list');
    if (!container) return;

    if (groups.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No tienes grupos aún. ¡Crea uno nuevo!</p>';
      return;
    }

    container.innerHTML = groups.map(g => `
      <div class="group-card" onclick="Groups.openGroup('${g.id}')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.8rem;padding:1rem;margin-bottom:0.8rem;cursor:pointer;transition:all 0.2s;">
        <div style="display:flex;align-items:center;gap:0.8rem;">
          <div style="width:48px;height:48px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:white;">
            ${g.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;color:white;margin-bottom:0.2rem;">${g.name}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);">${g.member_count} miembros</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* Mostrar modal de crear grupo */
  function showCreateModal() {
    selectedUsers = [];
    currentGroupId = null;
    document.getElementById('group-name').value = '';
    document.getElementById('group-user-search').value = '';
    document.getElementById('group-search-results').classList.add('hidden');
    document.getElementById('group-selected-users').innerHTML = '';
    document.getElementById('modal-create-group').classList.remove('hidden');
    
    // Configurar búsqueda en vivo
    const searchInput = document.getElementById('group-user-search');
    searchInput.oninput = (e) => {
      const term = e.target.value.trim();
      if (term.length >= 2) {
        searchUsers(term);
      } else {
        document.getElementById('group-search-results').classList.add('hidden');
      }
    };
  }

  /* Cerrar modal de crear grupo */
  function closeCreateModal() {
    document.getElementById('modal-create-group').classList.add('hidden');
  }

  /* Buscar usuarios para agregar al grupo */
  async function searchUsers(term) {
    try {
      // Primero crear un grupo temporal para la búsqueda
      if (!currentGroupId) {
        const createRes = await fetch('/api/groups', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + window._session?.token 
          },
          body: JSON.stringify({ name: 'temp' })
        });
        const createData = await createRes.json();
        if (createData.ok) {
          currentGroupId = createData.groupId;
        }
      }

      if (currentGroupId) {
        const res = await fetch(`/api/groups/${currentGroupId}/search?q=${encodeURIComponent(term)}`, {
          headers: { 'Authorization': 'Bearer ' + window._session?.token }
        });
        const data = await res.json();
        if (data.ok) {
          renderSearchResults(data.users);
        }
      }
    } catch (e) {
      console.error('Error al buscar usuarios:', e);
    }
  }

  /* Renderizar resultados de búsqueda */
  function renderSearchResults(users) {
    const container = document.getElementById('group-search-results');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem;">No se encontraron usuarios</p>';
    } else {
      container.innerHTML = users.map(u => `
        <div class="user-search-item" onclick="Groups.selectUser('${u.id}', '${u.name}', '${u.avatar || ''}')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.6rem;padding:0.8rem;margin-bottom:0.5rem;cursor:pointer;display:flex;align-items:center;gap:0.8rem;">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:600;color:white;">
            ${u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:500;color:white;">${u.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${u.online ? 'En línea' : 'Desconectado'}</div>
          </div>
        </div>
      `).join('');
    }
    container.classList.remove('hidden');
  }

  /* Seleccionar usuario */
  function selectUser(userId, userName, userAvatar) {
    if (selectedUsers.find(u => u.id === userId)) return;
    
    selectedUsers.push({ id: userId, name: userName, avatar: userAvatar });
    renderSelectedUsers();
    document.getElementById('group-search-results').classList.add('hidden');
    document.getElementById('group-user-search').value = '';
  }

  /* Renderizar usuarios seleccionados */
  function renderSelectedUsers() {
    const container = document.getElementById('group-selected-users');
    if (!container) return;

    if (selectedUsers.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;">Usuarios seleccionados (${selectedUsers.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        ${selectedUsers.map(u => `
          <div style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);border-radius:2rem;padding:0.4rem 0.8rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:0.85rem;color:white;">${u.name}</span>
            <button onclick="Groups.removeUser('${u.id}')" style="background:none;border:none;color:white;cursor:pointer;font-size:1rem;padding:0;line-height:1;">&times;</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* Remover usuario seleccionado */
  function removeUser(userId) {
    selectedUsers = selectedUsers.filter(u => u.id !== userId);
    renderSelectedUsers();
  }

  /* Crear grupo */
  async function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) {
      Toast.show('El nombre del grupo es requerido', 'error');
      return;
    }

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + window._session?.token 
        },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      
      if (data.ok) {
        // Agregar usuarios seleccionados
        for (const user of selectedUsers) {
          await fetch(`/api/groups/${data.groupId}/members`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + window._session?.token 
            },
            body: JSON.stringify({ userId: user.id })
          });
        }
        
        Toast.show('Grupo creado exitosamente', 'success');
        closeCreateModal();
        loadGroups();
      } else {
        Toast.show(data.msg || 'Error al crear grupo', 'error');
      }
    } catch (e) {
      console.error('Error al crear grupo:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* Abrir chat de grupo */
  function openGroup(groupId) {
    // TODO: Implementar chat de grupo
    Toast.show('Chat de grupo próximamente', 'info');
  }

  /* Inicializar cuando se entra a la sección de grupos */
  function init() {
    loadGroups();
  }

  return {
    showCreateModal,
    closeCreateModal,
    selectUser,
    removeUser,
    createGroup,
    openGroup,
    init
  };
})();

window.Groups = Groups;
