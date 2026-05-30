"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, Activity } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebhookType = any;

const formSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  url: z.string().url("URL inválida"),
  event: z.string().min(1, "Evento requerido"),
  secret: z.string().optional(),
});

export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", url: "", event: "message.received", secret: "" },
  });

  const loadWebhooks = () => {
    fetch("/api/webhooks")
      .then(res => res.json())
      .then(data => {
        setWebhooks(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      toast.success("Webhook creado exitosamente");
      setIsOpen(false);
      form.reset();
      loadWebhooks();
    } catch {
      toast.error("Error al crear el webhook");
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm("¿Eliminar este webhook?")) return;
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Webhook eliminado");
      loadWebhooks();
    } catch {
      toast.error("Error al eliminar");
    }
  }

  async function testWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Payload de prueba enviado. Revisa los logs.");
      loadWebhooks();
    } catch {
      toast.error("Error al disparar la prueba");
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
            <Webhook className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks (n8n)</h1>
            <p className="text-muted-foreground">Conecta eventos de CLIKA con n8n, Make o tus propios sistemas.</p>
          </div>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger>
            <Button className="gap-2" onClick={() => setIsOpen(true)}><Plus className="w-4 h-4"/> Crear Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Webhook</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="n8n Catch Hook" {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem><FormLabel>Endpoint URL</FormLabel><FormControl><Input placeholder="https://tu-n8n.com/webhook/..." {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="event"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Evento" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="message.received">Mensaje Recibido (message.received)</SelectItem>
                          <SelectItem value="message.sent">Mensaje Enviado (message.sent)</SelectItem>
                          <SelectItem value="contact.updated">Contacto Actualizado (contact.updated)</SelectItem>
                          <SelectItem value="appointment.created">Cita Creada (appointment.created)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem><FormLabel>Secret HMAC (Opcional)</FormLabel><FormControl><Input placeholder="my_secret_key" {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Guardar Webhook</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando webhooks...</TableCell></TableRow>
            ) : webhooks.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No tienes webhooks configurados.</TableCell></TableRow>
            ) : webhooks.map(wh => (
              <TableRow key={wh.id}>
                <TableCell className="font-medium">{wh.name}</TableCell>
                <TableCell><Badge variant="outline">{wh.event}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm" title={wh.url}>{wh.url}</TableCell>
                <TableCell>
                  {wh.lastStatus ? (
                    <Badge variant={wh.lastStatus >= 200 && wh.lastStatus < 300 ? "default" : "destructive"}>
                      HTTP {wh.lastStatus}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No ejecutado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => testWebhook(wh.id)} className="gap-1">
                    <Activity className="w-3 h-3"/> Test
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteWebhook(wh.id)}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
