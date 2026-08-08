import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const ChangePasswordModal = ({ isVisible, onClose, onSave, userData, API_URL }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
            setIsLoading(false);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    const handleSubmit = async () => {
        if (!currentPassword.trim()) {
            Alert.alert('Atenção', 'Por favor, digite sua senha atual.');
            return;
        }

        if (!newPassword.trim()) {
            Alert.alert('Atenção', 'Por favor, digite a nova senha.');
            return;
        }

        if (newPassword.length < 4) {
            Alert.alert('Atenção', 'A nova senha deve ter no mínimo 4 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Erro', 'A nova senha e a confirmação de senha não coincidem.');
            return;
        }

        // Se o objeto userData tiver senha registrada localmente, valida a senha atual
        if (userData && userData.password && userData.password !== currentPassword) {
            Alert.alert('Erro', 'A senha atual está incorreta.');
            return;
        }

        setIsLoading(true);

        try {
            // Chama callback de salvamento enviado via prop
            const success = await onSave({ currentPassword, newPassword });
            if (success) {
                Alert.alert('Sucesso', 'Sua senha foi alterada com sucesso!');
                onClose();
            }
        } catch (err) {
            console.error('Erro ao alterar senha:', err);
            Alert.alert('Erro', 'Não foi possível alterar a senha no momento.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.container}
                    >
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerTitleRow}>
                                    <View style={styles.iconBadge}>
                                        <Ionicons name="key-outline" size={22} color="#630ed4" />
                                    </View>
                                    <Text style={styles.title}>Alterar Senha</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={22} color="#5c5f61" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.subtitle}>
                                Digite sua senha atual e escolha a nova senha de acesso.
                            </Text>

                            {/* Campo: Senha Atual */}
                            <Text style={styles.label}>Senha Atual</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={18} color="#7b7487" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#7b7487"
                                    secureTextEntry={!showCurrentPassword}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeBtn}>
                                    <Ionicons name={showCurrentPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#7b7487" />
                                </TouchableOpacity>
                            </View>

                            {/* Campo: Nova Senha */}
                            <Text style={styles.label}>Nova Senha</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="key-outline" size={18} color="#7b7487" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Mínimo 4 caracteres"
                                    placeholderTextColor="#7b7487"
                                    secureTextEntry={!showNewPassword}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                                    <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#7b7487" />
                                </TouchableOpacity>
                            </View>

                            {/* Campo: Confirmar Nova Senha */}
                            <Text style={styles.label}>Confirmar Nova Senha</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="checkmark-circle-outline" size={18} color="#7b7487" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Repita a nova senha"
                                    placeholderTextColor="#7b7487"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                                    <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#7b7487" />
                                </TouchableOpacity>
                            </View>

                            {/* Botões */}
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isLoading}>
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
                                    {isLoading ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.saveBtnText}>Salvar Senha</Text>
                                        </>
                                    )}
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
        backgroundColor: 'rgba(19, 27, 46, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    container: {
        width: '100%',
        maxWidth: 420
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#630ed4',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#eaedff'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f2f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#131b2e'
    },
    closeBtn: {
        padding: 6
    },
    subtitle: {
        fontSize: 13,
        color: '#5c5f61',
        marginBottom: 20,
        lineHeight: 18
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4a4455',
        marginBottom: 6
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f3ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dae2fd',
        marginBottom: 16,
        height: 48,
        paddingHorizontal: 14
    },
    inputIcon: {
        marginRight: 10
    },
    input: {
        flex: 1,
        color: '#131b2e',
        fontSize: 14,
        height: '100%'
    },
    eyeBtn: {
        padding: 4
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12
    },
    cancelBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ccc3d8',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff'
    },
    cancelBtnText: {
        color: '#4a4455',
        fontWeight: '600',
        fontSize: 14
    },
    saveBtn: {
        flex: 1.5,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#630ed4',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#630ed4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3
    },
    saveBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14
    }
});
