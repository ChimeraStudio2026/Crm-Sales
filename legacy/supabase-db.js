/**
 * CRM Sales — Supabase persistence layer
 */
const CrmSupabase = (function createCrmSupabaseModule() {
    let client = null;
    let isReady = false;

    function getConfig() {
        if (typeof window === 'undefined' || !window.CRM_SUPABASE_CONFIG) {
            return null;
        }
        const config = window.CRM_SUPABASE_CONFIG;
        if (!config.url || !config.anonKey) {
            return null;
        }
        return config;
    }

    function initClient() {
        if (isReady) {
            return client;
        }
        const config = getConfig();
        const supabaseLib = typeof supabase !== 'undefined'
            ? supabase
            : (typeof globalThis !== 'undefined' ? globalThis.supabase : null);
        if (!config || !supabaseLib || typeof supabaseLib.createClient !== 'function') {
            return null;
        }
        client = supabaseLib.createClient(config.url, config.anonKey);
        isReady = true;
        return client;
    }

    function isEnabled() {
        return initClient() !== null;
    }

    function clientToRow(c) {
        const normalizedContacts = normalizeContactsArray(c.contacts, c.email, c.description);
        return {
            id: c.id,
            name: c.name,
            type: c.type || 'Cliente Diretto',
            owner: c.owner || 'Jeck',
            relationship: c.relationship || 'Nuovo Cliente',
            manual_relationship: !!c.manualRelationship,
            rev_2025: Number(c.rev2025) || 0,
            rev_2026: Number(c.rev2026) || 0,
            action: c.action || '',
            action_date: c.actionDate ? c.actionDate : null,
            email: normalizedContacts[0]?.email || c.email || '',
            description: normalizedContacts[0]?.description || c.description || '',
            contacts: normalizedContacts,
            needs_profile_completion: !!c.needsProfileCompletion,
            is_cold_client: !!c.isColdClient
        };
    }

    function normalizeContactsArray(contacts, legacyEmail, legacyDescription) {
        if (Array.isArray(contacts) && contacts.length > 0) {
            return contacts.map((contact) => ({
                id: contact.id || `contact-${Date.now()}`,
                email: contact.email || '',
                role: contact.role || ''
            }));
        }
        if (legacyEmail || legacyDescription) {
            return [{
                id: `contact-legacy-${Date.now()}`,
                email: legacyEmail || '',
                role: ''
            }];
        }
        return [];
    }

    function rowToClient(row) {
        const contacts = normalizeContactsArray(row.contacts, row.email, row.description);
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            owner: row.owner,
            relationship: row.relationship,
            manualRelationship: row.manual_relationship,
            rev2025: Number(row.rev_2025) || 0,
            rev2026: Number(row.rev_2026) || 0,
            action: row.action || '',
            actionDate: row.action_date || '',
            email: contacts[0]?.email || row.email || '',
            description: contacts[0]?.description || row.description || '',
            contacts,
            needsProfileCompletion: row.needs_profile_completion || false,
            isColdClient: row.is_cold_client === true
        };
    }

    function ideaToRow(i) {
        return {
            id: i.id,
            name: i.name,
            category: i.category || 'Content',
            client_id: i.clientId || null,
            status: i.status || 'Da fare',
            description: i.description || '',
            date_added: i.dateAdded || null
        };
    }

    function rowToIdea(row) {
        return {
            id: row.id,
            name: row.name,
            category: row.category,
            clientId: row.client_id || '',
            status: row.status,
            description: row.description || '',
            dateAdded: row.date_added || ''
        };
    }

    async function fetchClients() {
        const db = initClient();
        if (!db) return [];
        const { data, error } = await db.from('clients').select('*').order('name');
        if (error) throw error;
        return (data || []).map(rowToClient);
    }

    async function fetchIdeas() {
        const db = initClient();
        if (!db) return [];
        const { data, error } = await db.from('ideas').select('*').order('date_added', { ascending: false });
        if (error) throw error;
        return (data || []).map(rowToIdea);
    }

    async function removeOrphanRows(tableName, activeIds) {
        const db = initClient();
        if (!db) return;
        const { data: existing, error: fetchError } = await db.from(tableName).select('id');
        if (fetchError) throw fetchError;
        const orphanIds = (existing || [])
            .map(row => row.id)
            .filter(id => !activeIds.includes(id));
        if (orphanIds.length === 0) return;
        const { error: deleteError } = await db.from(tableName).delete().in('id', orphanIds);
        if (deleteError) throw deleteError;
    }

    async function persistClients(allClients) {
        const db = initClient();
        if (!db) return;
        const rows = allClients.map(clientToRow);
        if (rows.length === 0) {
            const { error } = await db.from('clients').delete().neq('id', '');
            if (error) throw error;
            return;
        }
        const { error: upsertError } = await db.from('clients').upsert(rows, { onConflict: 'id' });
        if (upsertError) throw upsertError;
        await removeOrphanRows('clients', rows.map(r => r.id));
    }

    async function persistIdeas(allIdeas) {
        const db = initClient();
        if (!db) return;
        const rows = allIdeas.map(ideaToRow);
        if (rows.length === 0) {
            const { error } = await db.from('ideas').delete().neq('id', '');
            if (error) throw error;
            return;
        }
        const { error: upsertError } = await db.from('ideas').upsert(rows, { onConflict: 'id' });
        if (upsertError) throw upsertError;
        await removeOrphanRows('ideas', rows.map(r => r.id));
    }

    async function deleteClient(clientId) {
        const db = initClient();
        if (!db) return;
        const { error } = await db.from('clients').delete().eq('id', clientId);
        if (error) throw error;
    }

    async function deleteIdea(ideaId) {
        const db = initClient();
        if (!db) return;
        const { error } = await db.from('ideas').delete().eq('id', ideaId);
        if (error) throw error;
    }

    async function fetchDailyRecall(recallDate) {
        const db = initClient();
        if (!db) return null;
        const { data, error } = await db.from('daily_recall').select('items').eq('recall_date', recallDate).maybeSingle();
        if (error) throw error;
        return data ? data.items : null;
    }

    async function saveDailyRecall(recallDate, items) {
        const db = initClient();
        if (!db) return;
        const { error } = await db.from('daily_recall').upsert({
            recall_date: recallDate,
            items: items
        }, { onConflict: 'recall_date' });
        if (error) throw error;
    }

    async function clearDailyRecall() {
        const db = initClient();
        if (!db) return;
        const { error } = await db.from('daily_recall').delete().neq('recall_date', '1900-01-01');
        if (error) throw error;
    }

    function rowToTask(row) {
        return {
            id: row.id,
            clientId: row.client_id,
            title: row.title,
            taskType: row.task_type || 'follow-up',
            dueDate: row.due_date || '',
            assignee: row.assignee || 'Jeck',
            completed: !!row.completed,
            notes: row.notes || '',
            createdAt: row.created_at || '',
            completedAt: row.completed_at || ''
        };
    }

    function taskToRow(task) {
        return {
            id: task.id,
            client_id: task.clientId,
            title: task.title,
            task_type: task.taskType || 'follow-up',
            due_date: task.dueDate || null,
            assignee: task.assignee || 'Jeck',
            completed: !!task.completed,
            notes: task.notes || '',
            created_at: task.createdAt || new Date().toISOString(),
            completed_at: task.completedAt || null
        };
    }

    async function fetchClientTasks() {
        const db = initClient();
        if (!db) return [];
        const { data, error } = await db.from('client_tasks').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(rowToTask);
    }

    async function persistClientTasks(tasks) {
        const db = initClient();
        if (!db) return;
        await db.from('client_tasks').delete().neq('id', '');
        if (tasks.length === 0) return;
        const rows = tasks.map(taskToRow);
        const { error } = await db.from('client_tasks').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
    }

    async function clearAll() {
        const db = initClient();
        if (!db) return;
        await db.from('client_tasks').delete().neq('id', '');
        await db.from('ideas').delete().neq('id', '');
        await db.from('clients').delete().neq('id', '');
        await db.from('okr_records').delete().neq('id', '');
        await db.from('analysis_forecasts').delete().neq('scope', '');
        await clearDailyRecall();
    }

    async function migrateFromLocalStorageIfEmpty(currentClients, currentIdeas) {
        if (currentClients.length > 0 || currentIdeas.length > 0) {
            return false;
        }
        const localClients = localStorage.getItem('crm_sales_data');
        const localIdeas = localStorage.getItem('crm_sales_ideas');
        if (!localClients && !localIdeas) {
            return false;
        }
        let parsedClients = [];
        let parsedIdeas = [];
        try {
            if (localClients) parsedClients = JSON.parse(localClients);
            if (localIdeas) parsedIdeas = JSON.parse(localIdeas);
        } catch (error) {
            console.warn('Migration localStorage fallita:', error);
            return false;
        }
        if (parsedClients.length > 0) await persistClients(parsedClients);
        if (parsedIdeas.length > 0) await persistIdeas(parsedIdeas);
        return parsedClients.length > 0 || parsedIdeas.length > 0;
    }

    async function testConnection() {
        const db = initClient();
        if (!db) return { ok: false, message: 'Config mancante (config.js)' };
        const { error } = await db.from('clients').select('id').limit(1);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: 'Connesso a Supabase' };
    }

    async function getApolloStatus() {
        const db = initClient();
        if (!db) return { ok: false, configured: false, message: 'Supabase non configurato' };
        try {
            const { data, error } = await db.functions.invoke('apollo-enrich', {
                body: { healthCheck: true }
            });
            if (error) return { ok: false, configured: false, message: error.message };
            return {
                ok: !!data?.configured,
                configured: !!data?.configured,
                message: data?.configured ? 'Apollo configurato' : 'APOLLO_API_KEY mancante su Supabase'
            };
        } catch (error) {
            return {
                ok: false,
                configured: false,
                message: error instanceof Error ? error.message : 'Apollo non disponibile'
            };
        }
    }

    async function enrichClientWithApollo(params) {
        const db = initClient();
        if (!db) {
            return { ok: false, error: 'Supabase non configurato' };
        }
        const { data, error } = await db.functions.invoke('apollo-enrich', {
            body: {
                companyName: params.companyName || '',
                email: params.email || '',
                domain: params.domain || ''
            }
        });
        if (error) {
            return { ok: false, error: error.message };
        }
        return data || { ok: false, error: 'Risposta Apollo vuota' };
    }

    function rowToOkr(row) {
        return {
            id: row.id,
            clientName: row.client_name,
            clientId: row.client_id || '',
            productType: row.product_type,
            amount: Number(row.amount) || 0,
            monthLabel: row.month_label || '',
            quarter: Number(row.quarter) || 0,
            projectCode: row.project_code || '',
            owner: row.owner || '',
            year: Number(row.year) || 2026
        };
    }

    function okrToRow(record) {
        return {
            id: record.id,
            client_name: record.clientName,
            client_id: record.clientId || null,
            product_type: record.productType,
            amount: Number(record.amount) || 0,
            month_label: record.monthLabel || '',
            quarter: Number(record.quarter) || 0,
            project_code: record.projectCode || '',
            owner: record.owner || '',
            year: Number(record.year) || 2026
        };
    }

    async function fetchOkrRecords(year = 2026) {
        const db = initClient();
        if (!db) return [];
        const { data, error } = await db.from('okr_records').select('*').eq('year', year);
        if (error) throw error;
        return (data || []).map(rowToOkr);
    }

    async function persistOkrRecords(records, year = 2026) {
        const db = initClient();
        if (!db) return;
        await db.from('okr_records').delete().eq('year', year);
        if (records.length === 0) return;
        const rows = records.map(okrToRow);
        const { error } = await db.from('okr_records').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
    }

    async function fetchAnalysisForecasts() {
        const db = initClient();
        if (!db) return null;
        const { data, error } = await db.from('analysis_forecasts').select('*');
        if (error) throw error;
        return data || [];
    }

    async function persistAnalysisForecasts(forecastRows) {
        const db = initClient();
        if (!db) return;
        const { error } = await db.from('analysis_forecasts').upsert(forecastRows, { onConflict: 'scope' });
        if (error) throw error;
    }

    return {
        isEnabled,
        fetchClients,
        fetchIdeas,
        persistClients,
        persistIdeas,
        deleteClient,
        deleteIdea,
        fetchDailyRecall,
        saveDailyRecall,
        clearDailyRecall,
        clearAll,
        migrateFromLocalStorageIfEmpty,
        testConnection,
        getApolloStatus,
        enrichClientWithApollo,
        fetchOkrRecords,
        persistOkrRecords,
        fetchAnalysisForecasts,
        persistAnalysisForecasts,
        fetchClientTasks,
        persistClientTasks
    };
})();
