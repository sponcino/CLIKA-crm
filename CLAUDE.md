# CLAUDE.md — WhatsApp CRM SaaS con IA

## Visión del producto

Estamos construyendo un SaaS CRM para WhatsApp conectado a la API oficial de Meta / WhatsApp Cloud API. El sistema permite gestionar conversaciones, leads, automatizaciones con IA, agenda, plantillas, base de conocimiento, funnels comerciales y webhooks externos para n8n.

El producto debe funcionar como un CRM inteligente donde cada conversación de WhatsApp puede crear o actualizar automáticamente un contacto, calificarlo, asignarle un estado, agendar reuniones y disparar automatizaciones externas.

## Objetivo principal

Crear una plataforma SaaS multiempresa para negocios, agencias y equipos comerciales que quieran vender, atender y automatizar por WhatsApp usando IA.

## Requerimientos obligatorios

* Conexión oficial con Meta WhatsApp Cloud API.
* Recepción de mensajes mediante webhooks de Meta.
* Envío de mensajes por WhatsApp Cloud API.
* Soporte para plantillas de WhatsApp.
* Webhooks salientes hacia n8n.
* CRM de contactos/leads.
* Inbox de conversaciones en tiempo real.
* Agente de IA configurable.
* Intervención humana.
* Agenda y reprogramación de citas.
* Base de conocimiento tipo RAG.
* Funnels configurables.
* Reportes.
* Sistema multi-tenant.
* Roles y permisos.
* Panel de configuración por workspace.

## Módulos del producto

### 1. Auth y SaaS multi-tenant

Crear sistema de autenticación con workspaces. Cada workspace representa una empresa cliente.

Entidades:

* User
* Workspace
* WorkspaceMember
* Role
* Permission
* SubscriptionPlan

Roles iniciales:

* owner
* admin
* manager
* agent
* viewer

Cada usuario puede pertenecer a varios workspaces.

### 2. Conexión Meta / WhatsApp

Cada workspace debe poder conectar su cuenta de WhatsApp Business.

Guardar:

* business_id
* waba_id
* phone_number_id
* display_phone_number
* access_token cifrado
* webhook_verify_token
* app_secret
* connection_status
* last_connection_check_at

Funcionalidades:

* Validar conexión.
* Enviar mensaje de prueba.
* Recibir webhooks.
* Normalizar mensajes entrantes.
* Registrar errores de Meta.
* Manejar ventana de 24 horas.
* Detectar si debe usarse plantilla.

### 3. Inbox de conversaciones

Pantalla principal para gestionar chats.

Debe incluir:

* Lista de conversaciones.
* Filtros por estado, etiqueta, agente, fecha y canal.
* Chat en tiempo real.
* Historial completo.
* Enviar mensaje manual.
* Pausar IA.
* Reactivar IA.
* Asignar responsable.
* Agregar nota interna.
* Agregar etiquetas.
* Ver ficha del contacto al lado derecho.
* Alerta de ventana de 24 horas.
* Indicador de IA activa o intervención humana.

Estados de conversación:

* open
* pending
* human_required
* closed
* archived

### 4. CRM de contactos

Cada contacto debe crearse automáticamente al recibir un mensaje nuevo.

Campos:

* id
* workspace_id
* whatsapp_phone
* whatsapp_name
* full_name
* email
* company
* business_type
* need_summary
* lead_source
* campaign_id
* ad_id
* status
* lead_score
* tags
* assigned_user_id
* ai_enabled
* created_at
* updated_at
* last_message_at

Estados de lead:

* new
* contacted
* qualified
* interested
* appointment_scheduled
* proposal_sent
* won
* lost

### 5. Agente de IA

El agente debe poder conversar con leads y ejecutar acciones internas.

Capacidades:

* Responder preguntas.
* Capturar nombre, email, empresa, tipo de negocio y necesidad.
* Actualizar contacto.
* Calificar lead.
* Cambiar estado.
* Consultar agenda.
* Crear cita.
* Reprogramar cita.
* Cancelar cita.
* Consultar base de conocimiento.
* Escalar a humano.
* Disparar webhook.

Configuración editable:

* agent_name
* business_context
* tone
* language
* welcome_message
* fallback_message
* human_escalation_message
* working_hours
* required_fields
* qualification_rules
* system_prompt
* model_provider
* model_name
* temperature

Reglas:

* Nunca inventar información de la empresa.
* Usar base de conocimiento cuando corresponda.
* Pedir datos faltantes de forma natural.
* No confirmar citas fuera del horario disponible.
* Escalar a humano si hay quejas, abuso, confusión o intención sensible.
* Registrar cada tool call.

### 6. Base de conocimiento / RAG

Permitir cargar conocimiento para que el agente responda.

Entidades:

* KnowledgeDocument
* KnowledgeChunk
* Embedding
* KnowledgeCategory

Categorías:

* Información general
* Productos
* Servicios
* Precios
* Preguntas frecuentes
* Políticas
* Casos de uso
* Objeciones comerciales

Funcionalidades:

* Crear documento manual.
* Subir archivo.
* Procesar texto.
* Chunking.
* Embeddings.
* Búsqueda semántica.
* Probador de búsqueda.
* Score de relevancia.
* Activar/desactivar documento.

### 7. Agenda

Sistema de citas integrado al agente.

Entidades:

* Appointment
* AvailabilityRule
* CalendarBlock

Appointment:

* contact_id
* workspace_id
* title
* start_time
* end_time
* status
* notes
* created_by_ai
* rescheduled_count

Funcionalidades:

* Vista diaria.
* Vista semanal.
* Vista mensual.
* Crear cita manual.
* Crear cita por IA.
* Reprogramar por IA.
* Cancelar por IA.
* Reglas de disponibilidad.
* Horario laboral.
* Duración de cita.
* Buffer entre citas.

### 8. Plantillas WhatsApp

Gestionar plantillas aprobadas de Meta.

Entidades:

* WhatsAppTemplate
* TemplateVariable
* TemplateSendLog

Funcionalidades:

* Sincronizar plantillas desde Meta.
* Enviar plantilla individual.
* Enviar plantilla masiva.
* Variables dinámicas.
* Filtrar contactos.
* Historial de envíos.
* Estado de entrega.
* Programación futura.

### 9. Webhooks para n8n

Permitir configurar webhooks salientes por workspace.

Eventos:

* message.received
* message.sent
* contact.created
* contact.updated
* lead.status_changed
* lead.score_updated
* appointment.created
* appointment.updated
* appointment.cancelled
* human_takeover.started
* human_takeover.ended
* template.sent
* conversation.closed

Cada webhook debe tener:

* name
* url
* event
* enabled
* secret
* custom_headers
* last_status
* last_error
* created_at

Funcionalidades:

* Crear webhook.
* Activar/desactivar.
* Probar webhook.
* Ver logs.
* Reintentos.
* Firma HMAC.
* Payload JSON consistente.

### 10. Reportes

Métricas:

* Leads totales.
* Leads nuevos por día.
* Conversaciones por día.
* Tiempo promedio de respuesta.
* Conversión por etapa.
* Citas agendadas.
* Citas canceladas.
* Citas reprogramadas.
* Porcentaje de intervención humana.
* Porcentaje atendido por IA.
* Lead score promedio.
* Rendimiento por campaña.
* Plantillas enviadas.

### 11. Seguridad

Obligatorio:

* Tokens cifrados.
* Separación por workspace.
* Validación de firma de webhooks Meta.
* Rate limits.
* Logs de auditoría.
* Control de permisos.
* Sanitización de inputs.
* Protección contra prompt injection.
* Backups.
* Manejo seguro de errores.
* No exponer access tokens al frontend.

## Stack recomendado

Frontend:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Query
* Zustand

Backend:

* Next.js API routes o NestJS
* PostgreSQL
* Prisma
* Redis
* BullMQ para jobs
* WebSockets o Server-Sent Events para inbox en tiempo real

IA:

* Claude / OpenAI como provider configurable
* Embeddings
* Vector database: pgvector o Pinecone

Infra:

* Vercel para frontend
* Railway / Render / Fly.io / AWS para backend
* Supabase o Neon para PostgreSQL
* Upstash Redis
* S3 compatible storage para archivos

Integraciones:

* Meta WhatsApp Cloud API
* n8n webhooks
* Google Calendar opcional

## Prioridad MVP

Fase 1:

* Auth
* Workspace
* Conexión WhatsApp
* Webhook entrante Meta
* Inbox básico
* CRM automático
* Envío manual de mensajes

Fase 2:

* Agente IA
* Captura automática de datos
* Lead scoring
* Pausar/reactivar IA
* Webhooks n8n

Fase 3:

* Agenda
* Reprogramación
* Plantillas WhatsApp
* Base de conocimiento RAG

Fase 4:

* Reportes
* Funnels
* Roles avanzados
* White label
* Automatizaciones avanzadas

## Reglas para Claude Code

Antes de escribir código:

1. Leer este archivo.
2. Proponer plan técnico.
3. Dividir tareas en pasos pequeños.
4. No crear features fuera del alcance.
5. Mantener arquitectura multi-tenant desde el inicio.
6. Nunca guardar tokens sin cifrado.
7. Toda tabla debe tener workspace_id si pertenece a una empresa.
8. Toda acción sensible debe validar permisos.
9. Todo endpoint debe validar autenticación.
10. Priorizar código limpio, tipado y mantenible.

## Definición de éxito

El MVP será exitoso cuando:

* Un lead escriba al WhatsApp.
* El mensaje llegue al CRM.
* Se cree el contacto automáticamente.
* La IA pueda responder.
* La IA pueda capturar datos.
* El humano pueda tomar control.
* Se pueda enviar un webhook a n8n.
* Se pueda agendar una cita.
* Toda la actividad quede registrada.
