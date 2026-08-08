import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SplitBillModal } from './SplitBillModal';

// Cores do Design System (Kinetic POS)
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

// Componente do Cartão de Pagamento Animado
const PaymentMethodCard = ({ method, isActive, hasValue, value, onPress }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isActive || hasValue ? 1.03 : 1,
            friction: 5,
            useNativeDriver: true
        }).start();
    }, [isActive, hasValue]);

    return (
        <Animated.View style={[styles.paymentCard, { transform: [{ scale: scaleAnim }], borderColor: isActive || hasValue ? colors.primary : colors.outlineVariant, borderWidth: isActive || hasValue ? 2 : 1, backgroundColor: isActive || hasValue ? '#f5f0ff' : '#ffffff' }]}>
            <TouchableOpacity 
                activeOpacity={0.85} 
                style={styles.cardPressable} 
                onPress={onPress}
            >
                <MaterialCommunityIcons 
                    name={method.icon} 
                    size={28} 
                    color={isActive || hasValue ? colors.primary : colors.onSurfaceVariant} 
                />
                <Text style={[isActive || hasValue ? styles.paymentNameActive : styles.paymentName]}>
                    {method.name}
                </Text>
                
                {/* Exibe o valor preenchido/selecionado */}
                {(isActive || hasValue) && (
                    <Text style={styles.methodValueText}>
                        R$ {parseFloat(value || 0).toFixed(2).replace('.', ',')}
                    </Text>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

export const CloseTableModal = ({ visible, onClose, onConfirm, order, orderItems, tableNum, onSplitBill, onPartialPayment }) => {
    // Valores já pagos nesta mesa
    const alreadyPaid = (order?.paidCash || 0) + (order?.paidPix || 0) + (order?.paidCard || 0);
    const alreadyPaidTip = order?.tip || 0;

    const initialSubtotal = order?.total ? parseFloat(order.total) : 0;
    const initialRemainingSubtotal = Math.max(0, initialSubtotal - alreadyPaid);
    const initialRemainingTip = Math.max(0, (initialSubtotal * 0.10) - alreadyPaidTip);

    // Estados para subtotal e gorjeta editáveis
    const [subtotalString, setSubtotalString] = useState(initialRemainingSubtotal.toFixed(2));
    const [tipString, setTipString] = useState(initialRemainingTip.toFixed(2));
    
    const subtotal = parseFloat(String(subtotalString).replace(',', '.')) || 0;
    const tip = parseFloat(String(tipString).replace(',', '.')) || 0;

    // Valores parciais inseridos para cada método de pagamento (Opção B)
    const [paymentValues, setPaymentValues] = useState({});
    const [activeMethod, setActiveMethod] = useState(null);

    // Modal de Divisão de Conta
    const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);

    // Sincroniza e reseta quando o modal é aberto ou a mesa/pagamentos parciais mudam
    useEffect(() => {
        if (visible && order) {
            const s = order.total ? parseFloat(order.total) : 0;
            const paid = (order.paidCash || 0) + (order.paidPix || 0) + (order.paidCard || 0);
            const paidTip = order.tip || 0;
            const remainingSub = Math.max(0, s - paid);
            const remainingT = Math.max(0, (s * 0.10) - paidTip);

            setSubtotalString(remainingSub.toFixed(2));
            setTipString(remainingT.toFixed(2));
            setPaymentValues({});
            setActiveMethod(null);
        }
    }, [visible, order?.id, order?.paidCash, order?.paidPix, order?.paidCard, order?.tip]);

    const finalTotal = subtotal + tip;
    const totalPaid = Object.values(paymentValues).reduce((acc, val) => acc + (parseFloat(String(val).replace(',', '.')) || 0), 0);
    const balance = finalTotal - totalPaid;
    const isPaid = Math.round(balance * 100) <= 0;

    // Sincroniza o valor do método ativo se o total final mudar
    useEffect(() => {
        if (activeMethod) {
            setPaymentValues(prev => {
                const next = { ...prev };
                const otherTotal = Object.entries(next)
                    .filter(([key]) => key !== activeMethod)
                    .reduce((acc, [_, val]) => acc + (parseFloat(String(val).replace(',', '.')) || 0), 0);
                const newBalance = finalTotal - otherTotal;
                next[activeMethod] = Math.max(0, newBalance).toFixed(2);
                return next;
            });
        }
    }, [finalTotal, activeMethod]);

    const toggleMethod = (id) => {
        if (activeMethod === id) {
            setActiveMethod(null);
            setPaymentValues(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } else {
            const previousActive = activeMethod;
            setActiveMethod(id);
            setPaymentValues(prev => {
                const next = { ...prev };
                // Se o ativo anterior tinha o valor total da conta (não era divisão), limpamos ele
                if (previousActive && parseFloat(String(next[previousActive] || 0).replace(',', '.')) >= finalTotal - 0.05) {
                    delete next[previousActive];
                }
                const tempTotalPaid = Object.entries(next)
                    .filter(([key]) => key !== id)
                    .reduce((acc, [_, val]) => acc + (parseFloat(String(val).replace(',', '.')) || 0), 0);
                const tempBalance = finalTotal - tempTotalPaid;
                next[id] = Math.max(0, tempBalance).toFixed(2);
                return next;
            });
        }
    };

    // Aplica o valor vindo do SplitBillModal ao método selecionado
    const handleApplySplitPayment = (methodId, amount) => {
        setPaymentValues(prev => ({
            ...prev,
            [methodId]: amount.toFixed(2)
        }));
        setActiveMethod(null); // Mantém nulo para evitar que o auto-fill preencha com o total
        setIsSplitModalVisible(false); // Fecha o modal de divisão
    };

    // Definição do Grid de Pagamentos 2x2
    const paymentMethods = [
        { id: 'credit', name: 'Crédito', icon: 'credit-card-outline' },
        { id: 'debit', name: 'Débito', icon: 'credit-card-check-outline' },
        { id: 'pix', name: 'PIX', icon: 'qrcode-scan' },
        { id: 'cash', name: 'Dinheiro', icon: 'cash' }
    ];

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.modalContent}>
                    
                    {/* CABEÇALHO (Header) */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Mesa {tableNum}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <Ionicons name="close" size={24} color={colors.onSurface} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
                        
                        {/* CARTÃO DE RESUMO */}
                        <View style={styles.summaryCard}>
                            
                            {/* Subtotal Editável */}
                            <View style={styles.row}>
                                <Text style={styles.summaryText}>Subtotal</Text>
                                <View style={styles.tipRow}>
                                    <Text style={styles.summaryText}>R$ </Text>
                                    <TextInput 
                                        style={styles.tipInput} 
                                        keyboardType="numeric" 
                                        value={subtotalString} 
                                        onChangeText={(val) => {
                                            setSubtotalString(val);
                                            const num = parseFloat(val.replace(',', '.')) || 0;
                                            setTipString((num * 0.10).toFixed(2));
                                        }} 
                                    />
                                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
                                </View>
                            </View>
                            
                            {/* Gorjeta de 10% Editável */}
                            <View style={[styles.row, { marginTop: 8 }]}>
                                <Text style={styles.summaryText}>10% (Gorjeta)</Text>
                                <View style={styles.tipRow}>
                                    <Text style={styles.summaryText}>R$ </Text>
                                    <TextInput 
                                        style={styles.tipInput} 
                                        keyboardType="numeric" 
                                        value={tipString} 
                                        onChangeText={setTipString} 
                                    />
                                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.row}>
                                <Text style={styles.totalLabel}>TOTAL</Text>
                                <Text style={styles.totalValue}>R$ {finalTotal.toFixed(2).replace('.', ',')}</Text>
                            </View>
                        </View>

                        {/* ALERTA: FALTANDO / PAGO */}
                        <View style={[styles.alertBox, { backgroundColor: isPaid ? '#E8F5E9' : colors.errorContainer }]}>
                            <Ionicons name={isPaid ? "checkmark-circle-outline" : "warning-outline"} size={20} color={isPaid ? '#2E7D32' : colors.error} />
                            <Text style={[styles.alertText, { color: isPaid ? '#2E7D32' : colors.error }]}>
                                {isPaid ? 'Pago' : `Faltando: R$ ${balance.toFixed(2).replace('.', ',')}`}
                            </Text>
                        </View>

                        {/* GRID DE MÉTODOS DE PAGAMENTO (2x2) */}
                        <Text style={styles.sectionTitle}>Método de Pagamento</Text>
                        <View style={styles.paymentGrid}>
                            {paymentMethods.map(m => (
                                <PaymentMethodCard 
                                    key={m.id}
                                    method={m}
                                    isActive={activeMethod === m.id}
                                    hasValue={parseFloat(paymentValues[m.id]) > 0}
                                    value={paymentValues[m.id]}
                                    onPress={() => toggleMethod(m.id)}
                                />
                            ))}
                        </View>
                    </ScrollView>

                    {/* RODAPÉ (Botões Inferiores) */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.splitBtn} onPress={() => setIsSplitModalVisible(true)}>
                            <MaterialCommunityIcons name="arrow-split-vertical" size={20} color={colors.error} />
                            <Text style={styles.splitBtnText}>Dividir Conta</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.finishBtn, !isPaid && { opacity: 0.5, backgroundColor: colors.outlineVariant }]}
                            disabled={!isPaid}
                            onPress={() => onConfirm({
                                paidCash: (parseFloat(paymentValues.cash) || 0) + (order?.paidCash || 0),
                                paidPix: (parseFloat(paymentValues.pix) || 0) + (order?.paidPix || 0),
                                paidCard: (parseFloat(paymentValues.credit) || 0) + (parseFloat(paymentValues.debit) || 0) + (order?.paidCard || 0),
                                tip: tip,
                                discount: 0,
                                total: finalTotal
                            })}
                        >
                            <MaterialCommunityIcons name="cash-register" size={20} color={colors.onPrimary} />
                            <Text style={styles.finishBtnText}>Finalizar Mesa</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Modal Secundário de Dividir Conta */}
                    <SplitBillModal 
                        visible={isSplitModalVisible}
                        onClose={() => setIsSplitModalVisible(false)}
                        orderItems={orderItems}
                        subtotal={subtotal}
                        onApplyPayment={handleApplySplitPayment}
                        onPartialPayment={onPartialPayment}
                        tableNum={tableNum}
                    />

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// ESTILOS KINETIC POS
const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(28, 27, 27, 0.5)', justifyContent: 'flex-end' },
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
        backgroundColor: colors.surface
    },
    iconBtn: { padding: 8 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: colors.primary },
    body: { paddingHorizontal: 16 },
    
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        marginBottom: 16
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryText: { fontSize: 16, color: colors.onSurfaceVariant },
    tipRow: { flexDirection: 'row', alignItems: 'center' },
    tipInput: { fontSize: 16, color: colors.onSurfaceVariant, minWidth: 60, textAlign: 'right', fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: 16 },
    totalLabel: { fontSize: 18, fontWeight: '600', color: colors.onSurface },
    totalValue: { fontSize: 44, fontWeight: '700', color: colors.primary, letterSpacing: -0.02 },
    
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24
    },
    alertText: { fontSize: 18, fontWeight: '700', marginLeft: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.onSurface, marginBottom: 12 },
    
    paymentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    paymentCard: {
        width: '48%',
        borderRadius: 12,
        marginBottom: 12,
        minHeight: 110,
        elevation: 1.5,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
    },
    cardPressable: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    paymentName: { marginTop: 6, fontSize: 15, fontWeight: '600', color: colors.onSurfaceVariant },
    paymentNameActive: { marginTop: 6, fontSize: 15, fontWeight: '600', color: colors.primary },
    inputWrapper: {
        width: '85%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    methodInput: {
        marginTop: 6,
        width: '100%',
        height: 36,
        borderBottomWidth: 1.5,
        borderColor: colors.primary,
        textAlign: 'center',
        fontSize: 16,
        color: colors.primary,
        fontWeight: 'bold',
    },
    methodValueText: { marginTop: 6, fontSize: 16, fontWeight: 'bold', color: colors.primary },
    
    footer: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: colors.surfaceVariant,
        gap: 12
    },
    splitBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.error,
        backgroundColor: '#ffffff'
    },
    splitBtnText: { color: colors.error, fontWeight: '700', fontSize: 16, marginLeft: 8 },
    finishBtn: {
        flex: 1.5,
        flexDirection: 'row',
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: colors.primary
    },
    finishBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16, marginLeft: 8 }
});
