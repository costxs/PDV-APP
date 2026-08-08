import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Modal,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';

export const QuantityModal = ({ isVisible, product, onConfirm, onCancel, theme }) => {
    const [quantity, setQuantity] = useState(1);
    const [observation, setObservation] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (isVisible) {
            setQuantity(1);
            setObservation('');
        }
    }, [isVisible, product]);

    if (!isVisible || !product) return null;

    const handleIncrement = () => setQuantity(prev => prev + 1);
    const handleDecrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

    const total = (product.price * quantity).toFixed(2);

    const defaultTheme = {
        primary: '#5A18E6',
        surface: '#FFFFFF',
        bgApp: '#F4F6F8',
        textMain: '#212121'
    };

    const currentTheme = theme || defaultTheme;

    return (
        <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.container}
                    >
                        <View style={[styles.modalContent, { backgroundColor: currentTheme.surface }]}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={[styles.productName, { color: currentTheme.textMain }]}>
                                    {product.name}
                                </Text>
                                <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                                    <Feather name="x" size={24} color="#888" />
                                </TouchableOpacity>
                            </View>

                            {/* Quantidade */}
                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    onPress={handleDecrement}
                                    style={[styles.qtyBtn, { borderColor: '#DDD', backgroundColor: '#F5F5F5' }]}
                                >
                                    <Feather name="minus" size={24} color={currentTheme.textMain} />
                                </TouchableOpacity>

                                <View style={styles.qtyValueContainer}>
                                    <Text style={[styles.qtyText, { color: currentTheme.textMain }]}>
                                        {quantity}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={handleIncrement}
                                    style={[styles.qtyBtn, { backgroundColor: currentTheme.primary || '#FF9800', borderWeight: 0 }]}
                                >
                                    <Feather name="plus" size={24} color="white" />
                                </TouchableOpacity>
                            </View>

                            {/* Observação */}
                            <View style={styles.observationContainer}>
                                <Text style={styles.label}>Observação (Opcional)</Text>
                                <TextInput
                                    value={observation}
                                    onChangeText={setObservation}
                                    placeholder="Ex: Sem cebola, ponto da carne..."
                                    placeholderTextColor="#999"
                                    multiline={true}
                                    numberOfLines={4}
                                    style={styles.textArea}
                                />
                            </View>

                            {/* Total e Confirmar */}
                            <View style={styles.footer}>
                                <View style={styles.totalContainer}>
                                    <Text style={[styles.totalLabel, { color: currentTheme.textMain }]}>Total:</Text>
                                    <Text style={[styles.totalValue, { color: currentTheme.textMain }]}>R$ {total}</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => onConfirm(quantity, observation)}
                                    style={[styles.confirmButton, { backgroundColor: currentTheme.primary || '#FF9800' }]}
                                >
                                    <Feather name="check" size={20} color="white" />
                                    <Text style={styles.confirmButtonText}>ADICIONAR AO PEDIDO</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '90%',
        maxWidth: 400,
    },
    modalContent: {
        borderRadius: 12,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        paddingVertical: 20,
    },
    qtyBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyValueContainer: {
        width: 80,
    },
    qtyText: {
        fontSize: 36,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    observationContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    textArea: {
        width: '100%',
        minHeight: 80,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DDD',
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#212121',
        backgroundColor: '#fff',
    },
    footer: {
        marginTop: 10,
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    confirmButton: {
        width: '100%',
        padding: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    confirmButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
