# Explicação: Como funcionam os Roles e Coach ID nas Tabelas

## Estrutura das Tabelas

### 1. Tabela `club_staff`
Esta é a tabela onde todos os membros do staff são armazenados (exceto coaches).

**Campos principais:**
- `id` (uuid) - ID único de cada membro do staff
- `club_owner_id` (uuid) - ID do dono do clube que gerencia este staff
- `user_id` (uuid, nullable) - ID do utilizador autenticado (pode ser NULL)
- `name` (text) - Nome do membro do staff
- `email` (text) - Email do membro
- `phone` (text) - Telefone do membro
- `role` (text) - **ROLE DO STAFF**: 'admin', 'bar_staff', 'receptionist', 'club_owner', 'other'
- `is_active` (boolean) - Se o staff está ativo
- `permissions` (jsonb) - Permissões específicas

**Nota:** Coaches NÃO são armazenados aqui! Coaches têm uma tabela separada.

### 2. Tabela `club_coaches`
Esta é a tabela onde os coaches são armazenados.

**Campos principais:**
- `id` (uuid) - ID único do coach
- `club_owner_id` (uuid) - ID do dono do clube
- `user_id` (uuid) - ID do utilizador autenticado (NOT NULL)
- `name` (text) - Nome do coach
- `bio` (text) - Biografia do coach
- `specialties` (text[]) - Especialidades do coach
- `hourly_rate` (decimal) - Taxa horária
- `phone` (text) - Telefone do coach
- `email` (text) - Email do coach
- `is_active` (boolean) - Se o coach está ativo

**Exemplo de registo:**
```
id: fe0fbdf3-68ca-4372-b683-f3aa91cc67ea
club_owner_id: 123e4567-e89b-12d3-a456-426614174000
user_id: 987e6543-e21b-43d2-b654-321987654321
name: "João Silva"
bio: "Treinador profissional de padel"
phone: "+351912345678"
email: "joao@club.com"
is_active: true
```

### 3. Tabela `club_classes`
Esta é a tabela onde as aulas são armazenadas.

**Campos principais:**
- `id` (uuid) - ID único da aula
- `club_owner_id` (uuid) - ID do dono do clube
- `coach_id` (uuid, nullable) - **ID DO COACH** (referencia `club_coaches.id`)
- `class_type_id` (uuid) - Tipo de aula
- `scheduled_at` (timestamptz) - Data/hora da aula
- `status` (text) - Status da aula

**Exemplo de registo:**
```
id: 8ab0c9a3-3958-4164-874c-449fef2b6e92
club_owner_id: 123e4567-e89b-12d3-a456-426614174000
coach_id: fe0fbdf3-68ca-4372-b683-f3aa91cc67ea  ← Este é o ID do coach!
class_type_id: abc123...
scheduled_at: 2026-03-10 18:00:00
status: "scheduled"
```

## Como funciona a relação

### 1. Criar um Coach
Quando crias um coach (geralmente na tab "Academy" ou similar):
1. É criado um registo na tabela `club_coaches`
2. O sistema gera um `id` único (ex: `fe0fbdf3-68ca-4372-b683-f3aa91cc67ea`)
3. O `user_id` é obrigatório (coach precisa ter login)

### 2. Atribuir Coach a uma Aula
Quando crias uma aula e selecionas um coach:
1. O `coach_id` na tabela `club_classes` recebe o `id` do coach
2. Exemplo: `coach_id = fe0fbdf3-68ca-4372-b683-f3aa91cc67ea`

### 3. Buscar o Nome do Coach
Para mostrar o nome do professor na aula:
1. Buscas na tabela `club_coaches` onde `id = coach_id`
2. Obténs o `name` desse registo
3. Exemplo: `SELECT name FROM club_coaches WHERE id = 'fe0fbdf3-68ca-4372-b683-f3aa91cc67ea'`

## Resumo

- **Role**: Para staff geral, é definido na tabela `club_staff` no campo `role`
- **Coaches**: Têm uma tabela separada `club_coaches` (não estão em `club_staff`)
- **Coach ID**: É o `id` de um registo na tabela `club_coaches`
- **Relação**: `club_classes.coach_id` → `club_coaches.id`
- **Tabelas separadas**: 
  - `club_staff` - para admin, bar_staff, receptionist, club_owner, other
  - `club_coaches` - apenas para coaches

## Exemplo Prático

1. Criar coach:
   ```sql
   INSERT INTO club_coaches (club_owner_id, user_id, name, email, phone)
   VALUES ('owner-id', 'user-id', 'João Silva', 'joao@club.com', '+351912345678');
   -- Gera id: fe0fbdf3-68ca-4372-b683-f3aa91cc67ea
   ```

2. Criar aula com este coach:
   ```sql
   INSERT INTO club_classes (club_owner_id, coach_id, class_type_id, scheduled_at)
   VALUES ('owner-id', 'fe0fbdf3-68ca-4372-b683-f3aa91cc67ea', 'type-id', '2026-03-10 18:00:00');
   ```

3. Buscar nome do coach:
   ```sql
   SELECT cc.name 
   FROM club_classes cl
   JOIN club_coaches cc ON cc.id = cl.coach_id
   WHERE cl.id = 'aula-id';
   ```
