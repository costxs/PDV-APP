import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const colors = {
    surface: '#fcf9f8',
    surfaceVariant: '#e5e2e1',
    surfaceContainerLow: '#f6f3f2',
    onSurface: '#1c1b1b',
    onSurfaceVariant: '#494456',
    primary: '#4800b2',
    onPrimary: '#ffffff',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
    outline: '#7a7488',
    outlineVariant: '#cbc3d9',
};

export const SplitBillModal = ({ visible, onClose, orderItems, subtotal, onApplyPayment, onPartialPayment, tableNum }) => {
    const [activeTab, setActiveTab] = useState('people'); // 'people' | 'items'
    
    // Estados de pagamento da divisão
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [isPaying, setIsPaying] = useState(false);

    // --- Lógica de Dividir por Pessoas ---
    const [numPeople, setNumPeople] = useState(2);
    const personSubtotal = subtotal / numPeople;
    const personTip = personSubtotal * 0.10;
    const personTotal = personSubtotal + personTip;

    const handleIncrementPeople = () => setNumPeople(prev => prev + 1);
    const handleDecrementPeople = () => setNumPeople(prev => Math.max(1, prev - 1));

    // --- Lógica de Dividir por Itens ---
    const [selectedQuantities, setSelectedQuantities] = useState({});
    const [includeItemTip, setIncludeItemTip] = useState(true);

    // Inicializa as quantidades selecionadas para 0 quando o modal abre ou os itens mudam
    useEffect(() => {
        if (visible && orderItems) {
            const initial = {};
            orderItems.forEach(item => {
                initial[item.id] = 0;
            });
            setSelectedQuantities(initial);
            setSelectedMethod(null);
            setIsPaying(false);
        }
    }, [visible, orderItems]);

    const handleIncrementItem = (itemId, maxQty) => {
        setSelectedQuantities(prev => ({
            ...prev,
            [itemId]: Math.min(maxQty, (prev[itemId] || 0) + 1)
        }));
    };

    const handleDecrementItem = (itemId) => {
        setSelectedQuantities(prev => ({
            ...prev,
            [itemId]: Math.max(0, (prev[itemId] || 0) - 1)
        }));
    };

    // Calcular totais selecionados por item
    let selectedSubtotal = 0;
    if (orderItems) {
        orderItems.forEach(item => {
            const qty = selectedQuantities[item.id] || 0;
            selectedSubtotal += qty * (parseFloat(item.price) || 0);
        });
    }
    const selectedTip = includeItemTip ? selectedSubtotal * 0.10 : 0;
    const selectedTotal = selectedSubtotal + selectedTip;

    // Métodos de pagamento rápido para fechar a divisão
    const paymentMethods = [
        { id: 'credit', name: 'Crédito', icon: 'credit-card-outline' },
        { id: 'debit', name: 'Débito', icon: 'credit-card-check-outline' },
        { id: 'pix', name: 'PIX', icon: 'qrcode-scan' },
        { id: 'cash', name: 'Dinheiro', icon: 'cash' }
    ];

    const handleConfirmPartialPayment = async () => {
        const amountToPay = activeTab === 'people' ? personTotal : selectedTotal;
        if (amountToPay <= 0.01 || !selectedMethod) return;

        setIsPaying(true);

        const currentTip = activeTab === 'people' ? personTip : selectedTip;
        const currentSubtotal = activeTab === 'people' ? personSubtotal : selectedSubtotal;

        const paymentData = {
            amount: amountToPay,
            paidCash: selectedMethod === 'cash' ? currentSubtotal : 0,
            paidPix: selectedMethod === 'pix' ? currentSubtotal : 0,
            paidCard: (selectedMethod === 'credit' || selectedMethod === 'debit') ? currentSubtotal : 0,
            tip: currentTip
        };

        const success = await onPartialPayment(paymentData);
        setIsPaying(false);

        if (success) {
            setSelectedMethod(null);
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.modalContent}>
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Dividir Conta</Text>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <Ionicons name="close" size={24} color={colors.onSurface} />
                        </TouchableOpacity>
                    </View>

                    {/* Abas (Tabs) */}
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity 
                            style={[styles.tabButton, activeTab === 'people' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('people')}
                        >
                            <MaterialCommunityIcons 
                                name="account-group-outline" 
                                size={20} 
                                color={activeTab === 'people' ? colors.primary : colors.onSurfaceVariant} 
                            />
                            <Text style={[styles.tabText, activeTab === 'people' && styles.tabTextActive]}>Dividir por Pessoas</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.tabButton, activeTab === 'items' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('items')}
                        >
                            <MaterialCommunityIcons 
                                name="format-list-checks" 
                                size={20} 
                                color={activeTab === 'items' ? colors.primary : colors.onSurfaceVariant} 
                            />
                            <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>Dividir por Itens</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Conteúdo das Abas */}
                    <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
                        
                        {activeTab === 'people' ? (
                            // CONTEÚDO: DIVIDIR POR PESSOAS
                            <View style={styles.tabContent}>
                                <Text style={styles.sectionLabel}>Quantas pessoas vão dividir a conta?</Text>
                                
                                <View style={styles.counterRow}>
                                    <TouchableOpacity style={styles.counterBtn} onPress={handleDecrementPeople}>
                                        <Ionicons name="remove" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                    <Text style={styles.counterValue}>{numPeople}</Text>
                                    <TouchableOpacity style={styles.counterBtn} onPress={handleIncrementPeople}>
                                        <Ionicons name="add" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.summaryCard}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Subtotal por Pessoa</Text>
                                        <Text style={styles.summaryValueText}>R$ {personSubtotal.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                                        <Text style={styles.summaryLabel}>10% Gorjeta por Pessoa</Text>
                                        <Text style={styles.summaryValueText}>R$ {personTip.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.totalLabel}>TOTAL POR PESSOA</Text>
                                        <Text style={styles.totalValue}>R$ {personTotal.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            // CONTEÚDO: DIVIDIR POR ITENS
                            <View style={styles.tabContent}>
                                <Text style={styles.sectionLabel}>Selecione a quantidade de itens a serem pagos:</Text>
                                
                                <View style={styles.itemsList}>
                                    {orderItems && orderItems.map(item => {
                                        const selectedQty = selectedQuantities[item.id] || 0;
                                        const name = item.product?.name || item.Product?.name || 'Item';
                                        
                                        return (
                                            <View key={item.id} style={styles.itemRow}>
                                                <View style={{ flex: 1.5 }}>
                                                    <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                                                    <Text style={styles.itemPriceText}>
                                                        {item.quantity} un. x R$ {parseFloat(item.price).toFixed(2).replace('.', ',')}
                                                    </Text>
                                                </View>

                                                <View style={styles.itemCounterRow}>
                                                    <TouchableOpacity 
                                                        style={[styles.itemCounterBtn, selectedQty === 0 && styles.itemCounterBtnDisabled]} 
                                                        onPress={() => handleDecrementItem(item.id)}
                                                        disabled={selectedQty === 0}
                                                    >
                                                        <Ionicons name="remove" size={16} color={selectedQty === 0 ? colors.outlineVariant : colors.primary} />
                                                    </TouchableOpacity>
                                                    
                                                    <Text style={styles.itemCounterValue}>{selectedQty}</Text>
                                                    
                                                    <TouchableOpacity 
                                                        style={[styles.itemCounterBtn, selectedQty === item.quantity && styles.itemCounterBtnDisabled]} 
                                                        onPress={() => handleIncrementItem(item.id, item.quantity)}
                                                        disabled={selectedQty === item.quantity}
                                                    >
                                                        <Ionicons name="add" size={16} color={selectedQty === item.quantity ? colors.outlineVariant : colors.primary} />
                                                    </TouchableOpacity>
                                                </View>

                                                <Text style={styles.itemRowTotal}>
                                                    R$ {(selectedQty * parseFloat(item.price)).toFixed(2).replace('.', ',')}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                <View style={styles.tipToggleRow}>
                                    <Text style={styles.tipToggleText}>Incluir 10% de Gorjeta nesta parte</Text>
                                    <TouchableOpacity 
                                        style={[styles.checkbox, includeItemTip && styles.checkboxChecked]}
                                        onPress={() => setIncludeItemTip(prev => !prev)}
                                    >
                                        {includeItemTip && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.summaryCard}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Subtotal Selecionado</Text>
                                        <Text style={styles.summaryValueText}>R$ {selectedSubtotal.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                                        <Text style={styles.summaryLabel}>Gorjeta Selecionada</Text>
                                        <Text style={styles.summaryValueText}>R$ {selectedTip.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.totalLabel}>TOTAL SELECIONADO</Text>
                                        <Text style={styles.totalValue}>R$ {selectedTotal.toFixed(2).replace('.', ',')}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Seção de Aplicação do Pagamento */}
                        <Text style={styles.sectionTitle}>Pagar esta parte com:</Text>
                        <View style={styles.paymentRow}>
                            {paymentMethods.map(m => {
                                const amountToPay = activeTab === 'people' ? personTotal : selectedTotal;
                                const isDisabled = amountToPay <= 0.01 || isPaying;
                                const isMethodSelected = selectedMethod === m.id;

                                return (
                                    <TouchableOpacity 
                                        key={m.id} 
                                        style={[
                                            styles.paymentBtn, 
                                            isDisabled && styles.paymentBtnDisabled,
                                            isMethodSelected && { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#f5f0ff' }
                                        ]} 
                                        onPress={() => setSelectedMethod(isMethodSelected ? null : m.id)}
                                        disabled={isDisabled}
                                    >
                                        <MaterialCommunityIcons 
                                            name={m.icon} 
                                            size={24} 
                                            color={isDisabled ? colors.outline : colors.primary} 
                                        />
                                        <Text style={[styles.paymentBtnText, isDisabled && styles.paymentBtnTextDisabled]}>
                                            {m.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                    </ScrollView>

                    {/* Botão de Confirmação de Pagamento Parcial */}
                    {selectedMethod && (
                        <View style={styles.confirmFooter}>
                            <TouchableOpacity 
                                style={[styles.confirmBtn, isPaying && { opacity: 0.7 }]} 
                                onPress={handleConfirmPartialPayment}
                                disabled={isPaying}
                            >
                                <Text style={styles.confirmBtnText}>
                                    {isPaying ? 'Processando...' : `Confirmar R$ ${(activeTab === 'people' ? personTotal : selectedTotal).toFixed(2).replace('.', ',')} no ${paymentMethods.find(m => m.id === selectedMethod)?.name}`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(28, 27, 27, 0.6)', justifyContent: 'flex-end' },
    modalContent: { 
        backgroundColor: colors.surface, 
        borderTopLeftRadius: 24, 
        borderTopRightRadius: 24, 
        height: '92%', 
        overflow: 'hidden' 
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant
    },
    iconBtn: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: colors.primary },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 6
    },
    tabButtonActive: {
        borderBottomWidth: 3,
        borderBottomColor: colors.primary
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.onSurfaceVariant
    },
    tabTextActive: {
        color: colors.primary
    },
    body: { paddingHorizontal: 16, paddingTop: 16 },
    tabContent: { marginBottom: 24 },
    sectionLabel: { fontSize: 16, fontWeight: '600', color: colors.onSurface, marginBottom: 16 },
    
    // Counter Dividir por Pessoas
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 20
    },
    counterBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: colors.outlineVariant,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    counterValue: { fontSize: 32, fontWeight: '700', color: colors.onSurface, minWidth: 40, textAlign: 'center' },
    
    // Items List
    itemsList: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        overflow: 'hidden',
        marginBottom: 16
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
        justifyContent: 'space-between'
    },
    itemName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
    itemPriceText: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    
    itemCounterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 8
    },
    itemCounterBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        justifyContent: 'center',
        alignItems: 'center'
    },
    itemCounterBtnDisabled: {
        backgroundColor: colors.surfaceContainerLow,
        borderColor: colors.outlineVariant
    },
    itemCounterValue: { fontSize: 15, fontWeight: '700', color: colors.onSurface, minWidth: 20, textAlign: 'center' },
    itemRowTotal: { fontSize: 15, fontWeight: '700', color: colors.primary, minWidth: 70, textAlign: 'right' },

    tipToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        marginBottom: 20
    },
    tipToggleText: { fontSize: 15, color: colors.onSurface, fontWeight: '500' },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.outline,
        justifyContent: 'center',
        alignItems: 'center'
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary
    },

    // Card de Totais
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 14, color: colors.onSurfaceVariant },
    summaryValueText: { fontSize: 14, fontWeight: '500', color: colors.onSurface },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: 14 },
    totalLabel: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
    totalValue: { fontSize: 26, fontWeight: '800', color: colors.primary },

    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.onSurface, marginTop: 12, marginBottom: 12 },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20
    },
    paymentBtn: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    paymentBtnDisabled: {
        backgroundColor: colors.surfaceContainerLow,
        opacity: 0.6,
        elevation: 0
    },
    paymentBtnText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
    paymentBtnTextDisabled: { color: colors.outline },
    confirmFooter: {
        padding: 16,
        backgroundColor: colors.surfaceVariant,
        borderTopWidth: 1,
        borderTopColor: colors.outlineVariant
    },
    confirmBtn: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    confirmBtnText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '700'
    }
});
