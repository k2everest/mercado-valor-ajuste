import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, DollarSign, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AdditionalCost {
  id?: string;
  user_id?: string;
  name: string;
  description?: string;
  cost_type: string;
  value: number;
  percentage_base?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CostManagementPanelProps {
  onCostsUpdate?: (costs: AdditionalCost[]) => void;
}

export const CostManagementPanel: React.FC<CostManagementPanelProps> = ({ onCostsUpdate }) => {
  const [costs, setCosts] = useState<AdditionalCost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCost, setEditingCost] = useState<AdditionalCost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState<AdditionalCost>({
    name: '',
    description: '',
    cost_type: 'fixed',
    value: 0,
    percentage_base: 'subtotal',
    is_active: true,
  });

  const loadCosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('additional_costs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCosts(data || []);
      onCostsUpdate?.(data || []);
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
      toast({
        title: "Erro ao carregar custos",
        description: "Não foi possível carregar a lista de custos adicionais",
        variant: "destructive",
      });
    }
  }, [toast, onCostsUpdate]);

  useEffect(() => {
    if (user) {
      loadCosts();
    }
  }, [loadCosts, user]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Você precisa estar logado",
        description: "Faça login para salvar custos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const basePayload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        cost_type: formData.cost_type,
        value: Number(formData.value) || 0,
        percentage_base: formData.cost_type === 'percentage' ? (formData.percentage_base || 'subtotal') : null,
        is_active: !!formData.is_active,
      };

      if (editingCost?.id) {
        const { error } = await supabase
          .from('additional_costs')
          .update(basePayload)
          .eq('id', editingCost.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: "Custo atualizado", description: "Custo adicional atualizado com sucesso" });
      } else {
        const insertPayload = { ...basePayload, user_id: user.id };
        const { error } = await supabase
          .from('additional_costs')
          .insert([insertPayload]);
        if (error) throw error;
        toast({ title: "Custo adicionado", description: "Novo custo adicional criado com sucesso" });
      }

      setFormData({
        name: '',
        description: '',
        cost_type: 'fixed',
        value: 0,
        percentage_base: 'subtotal',
        is_active: true,
      });
      setEditingCost(null);
      setShowForm(false);
      await loadCosts();
    } catch (error) {
      const err: any = error;
      console.error('Erro ao salvar custo:', err);
      toast({
        title: "Erro ao salvar custo",
        description: err?.message || 'Tente novamente.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [formData, editingCost, toast, loadCosts, user]);

  const handleEdit = useCallback((cost: AdditionalCost) => {
    setEditingCost(cost);
    setFormData(cost);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (costId: string) => {
    if (!confirm('Tem certeza que deseja excluir este custo?')) return;

    try {
      const { error } = await supabase
        .from('additional_costs')
        .delete()
        .eq('id', costId);

      if (error) throw error;

      toast({
        title: "Custo excluído",
        description: "Custo adicional excluído com sucesso",
      });

      await loadCosts();
    } catch (error) {
      console.error('Erro ao excluir custo:', error);
      toast({
        title: "Erro ao excluir custo",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast, loadCosts]);

  const handleToggleActive = useCallback(async (cost: AdditionalCost) => {
    try {
      const { error } = await supabase
        .from('additional_costs')
        .update({ is_active: !cost.is_active })
        .eq('id', cost.id);

      if (error) throw error;

      await loadCosts();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast, loadCosts]);

  const cancelEdit = useCallback(() => {
    setEditingCost(null);
    setShowForm(false);
    setFormData({
      name: '',
      description: '',
      cost_type: 'fixed',
      value: 0,
      percentage_base: 'subtotal',
      is_active: true,
    });
  }, []);

  const getCostTypeLabel = (type: string) => {
    switch (type) {
      case 'fixed': return 'Fixo';
      case 'variable': return 'Variável';
      case 'percentage': return 'Percentual';
      default: return type;
    }
  };

  const getPercentageBaseLabel = (base: string) => {
    switch (base) {
      case 'subtotal': return 'Subtotal';
      case 'total': return 'Total';
      case 'profit': return 'Lucro';
      default: return base;
    }
  };

  const formatValue = (cost: AdditionalCost) => {
    if (cost.cost_type === 'percentage') {
      return `${cost.value}% (${getPercentageBaseLabel(cost.percentage_base || 'subtotal')})`;
    }
    return `R$ ${cost.value.toFixed(2)}`;
  };

  const totalFixedCosts = costs
    .filter(c => c.cost_type === 'fixed' && c.is_active)
    .reduce((sum, c) => sum + c.value, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Gestão de Custos Adicionais
            </CardTitle>
            <CardDescription>
              Configure custos extras que serão incluídos no cálculo de precificação
            </CardDescription>
          </div>
          <Button 
            onClick={() => setShowForm(true)} 
            disabled={showForm}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Custo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingCost ? 'Editar Custo' : 'Novo Custo Adicional'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Custo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Embalagem, Marketing, etc."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cost_type">Tipo de Custo *</Label>
                    <Select
                      value={formData.cost_type}
                      onValueChange={(value: 'fixed' | 'variable' | 'percentage') => 
                        setFormData(prev => ({ ...prev, cost_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixo (valor absoluto)</SelectItem>
                        <SelectItem value="variable">Variável por produto</SelectItem>
                        <SelectItem value="percentage">Percentual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição detalhada do custo..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">
                      {formData.cost_type === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'} *
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>

                  {formData.cost_type === 'percentage' && (
                    <div className="space-y-2">
                      <Label htmlFor="percentage_base">Base do Percentual</Label>
                      <Select
                        value={formData.percentage_base || 'subtotal'}
                        onValueChange={(value: 'subtotal' | 'total' | 'profit') => 
                          setFormData(prev => ({ ...prev, percentage_base: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subtotal">Subtotal (preço de compra)</SelectItem>
                          <SelectItem value="total">Total (compra + impostos)</SelectItem>
                          <SelectItem value="profit">Lucro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Custo ativo</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? 'Salvando...' : editingCost ? 'Atualizar' : 'Salvar'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">R$ {totalFixedCosts.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Total de Custos Fixos Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{costs.filter(c => c.is_active).length}</div>
              <p className="text-xs text-muted-foreground">Custos Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{costs.length}</div>
              <p className="text-xs text-muted-foreground">Total de Custos</p>
            </CardContent>
          </Card>
        </div>

        {costs.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum custo adicional configurado. Adicione custos para incluí-los no cálculo de precificação.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custos Configurados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{cost.name}</div>
                          {cost.description && (
                            <div className="text-sm text-muted-foreground">{cost.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCostTypeLabel(cost.cost_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatValue(cost)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cost.is_active ? "default" : "secondary"}>
                          {cost.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(cost)}
                          >
                            <Switch checked={cost.is_active} className="pointer-events-none" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cost)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cost.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tipos de Custo:</strong><br />
            • <strong>Fixo:</strong> Valor absoluto distribuído proporcionalmente entre produtos<br />
            • <strong>Variável:</strong> Valor aplicado a cada produto individualmente<br />
            • <strong>Percentual:</strong> Percentual aplicado sobre a base selecionada
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};