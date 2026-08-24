import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, FlatList, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CloseTableModal } from './components/CloseTableModal';
import { ProductSelectorModal } from './components/ProductSelectorModal';
import { QuantityModal } from './components/QuantityModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { supabase } from './supabase';
const API_URL = "https://savora-6m9q.onrender.com";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [loginData, setLoginData] = useState({ restaurantCode: '', user: '', password: '' });
  const [userData, setUserData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [activeTab, setActiveTab] = useState('tables');

  const [activeArea, setActiveArea] = useState('MAIN');
  const [allTables, setAllTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const searchInputRef = React.useRef(null);

  // Products
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);
  const [isQuantityModalVisible, setIsQuantityModalVisible] = useState(false);
  const [isProductSelectorVisible, setIsProductSelectorVisible] = useState(false);

  const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
  const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [waiterTipsTotal, setWaiterTipsTotal] = useState(0);

  // Restaurar sessão salva do usuário ao iniciar o aplicativo
  useEffect(() => {
    const restoreSavedSession = async () => {
      try {
        const savedSession = await AsyncStorage.getItem('@savora_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed && parsed.userData) {
            setUserData(parsed.userData);
            setIsLoggedIn(true);
          }
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão salva:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    restoreSavedSession();
  }, []);

  const getElapsedTime = (order) => {
    if (!order) return '';
    const createdAt = order.created_at || order.createdAt || order.timestamp || order.created_time;
    if (!createdAt) return '0m';

    const startTime = new Date(createdAt).getTime();
    if (isNaN(startTime)) return '0m';

    const diffMinutes = Math.floor(Math.max(0, Date.now() - startTime) / 60000);
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  useEffect(() => {
    if (!userData) return;

    const tables = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, number: i + 1, area: 'MAIN' })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: i + 13, number: i + 13, area: 'FRONT' })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: i + 25, number: i + 25, area: 'OUTSIDE' })),
    ];
    setAllTables(tables);
    fetchOrders();
    fetchProducts();

    // Poll simple to mimic real-time & tick timer
    const interval = setInterval(() => {
      fetchOrders();
      setNowTick(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, [userData]);

  const saveClosedTip = async (tipValue) => {
    if (!userData?.id || tipValue <= 0) return;
    try {
      const key = `@savora_closed_tips_${userData.id}`;
      const existing = await AsyncStorage.getItem(key);
      const currentSum = parseFloat(existing || 0);
      const newSum = currentSum + tipValue;
      await AsyncStorage.setItem(key, newSum.toString());
    } catch (e) {
      console.error('Erro ao salvar comissão fechada:', e);
    }
  };

  const fetchWaiterTips = async () => {
    if (!userData) return;
    const wId = String(userData.id || userData.userId || userData.waiterId || userData.username || '');
    if (!wId) return;

    try {
      let calculatedTips = 0;

      // 0. Carrega comissões salvas de mesas fechadas pelo garçom nesta sessão
      try {
        const closedSaved = await AsyncStorage.getItem(`@savora_closed_tips_${userData.id}`);
        if (closedSaved) {
          calculatedTips += parseFloat(closedSaved) || 0;
        }
      } catch (_) {}

      // 1. Tenta buscar pedidos abertos do backend
      let openTips = 0;
      try {
        const res = await fetch(`${API_URL}/orders/open?rid=${userData.restaurantId}&t=${Date.now()}`);
        if (res.ok) {
          const orders = await res.json();
          if (Array.isArray(orders)) {
            const waiterOrders = orders.filter(o => String(o.waiterId || o.waiter_id) === wId);
            openTips = waiterOrders.reduce((acc, o) => {
              const tipVal = parseFloat(o.tip || 0);
              if (tipVal > 0) return acc + tipVal;
              return acc + (parseFloat(o.total || 0) * 0.10);
            }, 0);
          }
        }
      } catch (e) {
        console.error('Erro ao buscar pedidos abertos para comissões:', e);
      }

      // 2. Fallback com ordens em memória no estado activeOrders se a resposta da rede for vazia
      if (openTips === 0 && activeOrders && activeOrders.length > 0) {
        const waiterOrders = activeOrders.filter(o => String(o.waiterId || o.waiter_id) === wId);
        openTips = waiterOrders.reduce((acc, o) => {
          const tipVal = parseFloat(o.tip || 0);
          if (tipVal > 0) return acc + tipVal;
          return acc + (parseFloat(o.total || 0) * 0.10);
        }, 0);
      }

      calculatedTips += openTips;

      // 3. (Removido) Chamada direta ao Supabase foi removida para evitar o erro 400
      // Todo o cálculo de comissão agora depende da API Node (backend.sirotheau.com.br)

      setWaiterTipsTotal(calculatedTips);
    } catch (err) {
      console.error('Erro ao buscar comissões do garçom:', err);
    }
  };

  const handleChangePassword = async ({ currentPassword, newPassword }) => {
    try {
      // 1. Tenta enviar para a API backend se houver endpoint
      try {
        await fetch(`${API_URL}/users/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData?.id,
            username: userData?.username,
            currentPassword,
            newPassword,
            restaurantId: userData?.restaurantId
          })
        }).catch(() => null);
      } catch (_) {}

      // 2. Atualiza sessão do usuário localmente
      const updatedUser = { ...userData, password: newPassword };
      setUserData(updatedUser);
      await AsyncStorage.setItem('@savora_session', JSON.stringify({ userData: updatedUser }));

      return true;
    } catch (err) {
      console.error('Erro ao salvar nova senha:', err);
      Alert.alert('Erro', 'Não foi possível alterar a senha.');
      return false;
    }
  };

  useEffect(() => {
    if (!userData) return;
    fetchWaiterTips();
  }, [userData, activeTab, activeOrders, nowTick]);

  useEffect(() => {
    if (selectedTable) {
      const order = activeOrders.find(o => o.tableNum === selectedTable.number);
      setActiveOrder(order || null);
      setOrderItems(order ? (order.items || []) : []);
    }
  }, [activeOrders, selectedTable]);

  const fetchOrders = async () => {
    if (!userData?.restaurantId) return;
    try {
      const res = await fetch(`${API_URL}/orders/open?rid=${userData.restaurantId}&t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveOrders(data || []);
      }
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    if (!userData?.restaurantId) return;
    try {
      const res = await fetch(`${API_URL}/products?rid=${userData.restaurantId}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    if (text.trim() === '') {
      setFilteredProducts([]);
    } else {
      const filtered = products.filter(p => p.name.toLowerCase().includes(text.toLowerCase()));
      setFilteredProducts(filtered);
    }
  };

  const selectMainTable = (table) => {
    setSelectedTable(table);
    const order = activeOrders.find(o => o.tableNum === table.number);
    setActiveOrder(order || null);
    if (order) {
      setOrderItems(order.items || []);
    } else {
      setOrderItems([]);
    }
  };

  const openAddModal = (product) => {
    setSelectedProductToAdd(product);
    setIsProductSelectorVisible(false);
    setIsQuantityModalVisible(true);
  };

  const handleConfirmAddProduct = async (quantity, observation) => {
    if (!selectedTable || !selectedProductToAdd) return;

    try {
      const firstOrderCreatedAt = activeOrder ? (activeOrder.created_at || activeOrder.createdAt) : new Date().toISOString();
      const currentWaitTimeMs = activeOrder ? Math.max(0, Date.now() - new Date(firstOrderCreatedAt).getTime()) : 0;
      const currentWaitMinutes = Math.floor(currentWaitTimeMs / 60000);
      const totalItem = (parseFloat(selectedProductToAdd.price) || 0) * (quantity || 1);

      // Atualização otimista completa na raiz (activeOrders)
      const newItem = {
        id: 'temp-' + Date.now(),
        quantity: quantity,
        price: selectedProductToAdd.price,
        observation: observation || '',
        product: { name: selectedProductToAdd.name }
      };
      
      setActiveOrders(prev => {
        const orderExists = prev.find(o => o.tableNum === selectedTable.number);
        if (orderExists) {
          return prev.map(o => o.tableNum === selectedTable.number ? { ...o, total: o.total + totalItem, items: [...(o.items || []), newItem] } : o);
        } else {
          return [...prev, { 
            tableNum: selectedTable.number, 
            total: totalItem, 
            items: [newItem], 
            clientName: userData.name || userData.username || `Mesa ${selectedTable.number}`,
            created_at: firstOrderCreatedAt
          }];
        }
      });

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder ? activeOrder.id : undefined,
          tableNum: selectedTable.number,
          total: totalItem,
          clientName: userData.name || userData.username || `Mesa ${selectedTable.number}`,
          waiterId: String(userData.id),
          restaurantId: userData.restaurantId,
          createdAt: firstOrderCreatedAt,
          created_at: firstOrderCreatedAt,
          elapsedMinutes: currentWaitMinutes,
          items: [{ 
            id: selectedProductToAdd.id, 
            productId: selectedProductToAdd.id,
            quantity: quantity, 
            price: selectedProductToAdd.price,
            observation: observation || ''
          }]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erro do servidor: ${errText}`);
      }

      // Tenta obter o ID do pedido caso ele tenha acabado de ser criado
      let createdOrderId = activeOrder ? activeOrder.id : null;
      try {
        const responseData = await res.json();
        if (responseData && responseData.id) {
          createdOrderId = responseData.id;
        } else if (responseData && responseData.orderId) {
          createdOrderId = responseData.orderId;
        }
      } catch (e) {
        console.error('Erro ao extrair orderId', e);
      }

      // NOVO: Atualiza o status da cozinha de volta para PENDING.
      // Sem isso, pedidos que já foram "DELIVERED" param de aparecer no monitor da cozinha ao adicionar itens!
      if (createdOrderId) {
        await fetch(`${API_URL}/kitchen/orders/${createdOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PENDING' })
        }).catch(err => console.error('Erro ao voltar status para PENDING:', err));
      }

      // O backend (/orders) já cria automaticamente um PrintRequest, não precisamos chamar /print-requests aqui.

      setIsQuantityModalVisible(false);
      setSearchTerm('');
      setFilteredProducts([]);
      
      // Atrasa a busca real para dar tempo do backend salvar no Supabase
      setTimeout(() => {
        fetchOrders();
      }, 1500);

      Alert.alert('Sucesso', 'Item adicionado');
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha ao adicionar item');
    }
  };

  const handleConfirmClose = async (paymentData) => {
    if (!activeOrder) return;
    try {
      // 1. Efetiva o fechamento no Banco de Dados via Backend
      const resClose = await fetch(`${API_URL}/orders/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: selectedTable.number,
          paidCash: paymentData.paidCash,
          paidPix: paymentData.paidPix,
          paidCard: paymentData.paidCard,
          tip: paymentData.tip,
          restaurantId: userData.restaurantId,
          change: 0 // O App mobile geralmente não lida com troco complexo aqui
        })
      });

      if (!resClose.ok) {
        let errMsg = 'Não foi possível fechar a mesa no servidor.';
        try {
          const errData = await resClose.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        Alert.alert('Erro', errMsg);
        return;
      }

      const tipValue = parseFloat(paymentData.tip || 0) || (parseFloat(activeOrder.total || 0) * 0.10);
      await saveClosedTip(tipValue);

      setIsCloseModalVisible(false);
      setSelectedTable(null);
      setActiveOrder(null);
      fetchOrders();
      fetchWaiterTips();
      Alert.alert('Sucesso', 'Mesa fechada e enviada para o caixa!');
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha na conexão com o servidor.');
    }
  };

  const handleRequestBill = async () => {
    if (!activeOrder) return;
    try {
      await fetch(`${API_URL}/print-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: selectedTable.number,
          orderId: activeOrder.id,
          type: 'bill'
        })
      });

      setIsCloseModalVisible(true);
      fetchOrders();
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha na conexão com o servidor.');
    }
  };

  const handlePartialPayment = async (paymentData) => {
    if (!activeOrder) return false;
    try {
      const res = await fetch(`${API_URL}/orders/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: selectedTable.number,
          paidCash: paymentData.paidCash,
          paidPix: paymentData.paidPix,
          paidCard: paymentData.paidCard,
          tip: paymentData.tip,
          restaurantId: userData.restaurantId
        })
      });

      if (!res.ok) {
        let errMsg = 'Não foi possível processar o pagamento.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        Alert.alert('Erro', errMsg);
        return false;
      }

      const data = await res.json();
      
      if (data.isFullyPaid) {
        setIsCloseModalVisible(false);
        setSelectedTable(null);
        setActiveOrder(null);
        Alert.alert('Sucesso', 'Mesa quitada e fechada com sucesso!');
      } else {
        Alert.alert('Sucesso', `Pagamento de R$ ${paymentData.amount.toFixed(2).replace('.', ',')} registrado com sucesso!`);
      }
      
      await fetchOrders();
      return true;
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha na conexão com o servidor.');
      return false;
    }
  };

  const performDeletion = async (itemId) => {
    try {
      const res = await fetch(`${API_URL}/orders/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        let errMsg = 'Falha ao cancelar o item. Verifique a rota no servidor.';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }
      await fetchOrders();
      if (Platform.OS === 'web') {
        window.alert('Item cancelado com sucesso!');
      } else {
        Alert.alert('Sucesso', 'Item cancelado com sucesso!');
      }
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'web') {
        window.alert(err.message);
      } else {
        Alert.alert('Erro', err.message);
      }
    }
  };

  const handleDeleteItem = (itemId) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Tem certeza que deseja cancelar este item do pedido?');
      if (confirm) {
        performDeletion(itemId);
      }
    } else {
      Alert.alert(
        'Cancelar Item',
        'Tem certeza que deseja cancelar este item do pedido?',
        [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim', style: 'destructive', onPress: () => performDeletion(itemId) }
        ]
      );
    }
  };

  const handleCancelOrder = () => {
    if (!activeOrder) return;
    Alert.alert(
      'Cancelar Pedido Inteiro',
      'Tem certeza que deseja cancelar TODO o pedido? Esta ação excluirá a mesa.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/orders/${activeOrder.id}`, {
                method: 'DELETE'
              });
              if (!res.ok) {
                let errMsg = 'Falha ao cancelar o pedido.';
                try {
                  const errData = await res.json();
                  if (errData && errData.error) errMsg = errData.error;
                } catch (e) {}
                throw new Error(errMsg);
              }
              setSelectedTable(null);
              setActiveOrder(null);
              await fetchOrders();
              Alert.alert('Sucesso', 'Pedido excluído permanentemente!');
            } catch (err) {
              console.error(err);
              Alert.alert('Erro', err.message);
            }
          }
        }
      ]
    );
  };

  const handleReprintKitchen = async (orderId, tableNum) => {
    try {
      const res = await fetch(`${API_URL}/print-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: tableNum,
          orderId: orderId,
          type: 'kitchen'
        })
      });
      if (!res.ok) throw new Error('Falha ao enviar requisição');
      Alert.alert('Sucesso', 'Reimpressão solicitada para a cozinha!');
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha ao solicitar reimpressão.');
    }
  };


  const getTableStatus = (table) => {
    const order = activeOrders.find(o => o.tableNum === table.number);
    if (!order) return 'livre';
    if (order.kitchenStatus === 'ready') return 'aguardando';
    return 'ocupada';
  };

  if (selectedTable) {
    return (
      <View style={styles.detailsContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.detailsHeader}>
          <TouchableOpacity onPress={() => setSelectedTable(null)} style={styles.backHomeBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#630ed4" style={{ marginRight: 4 }} />
            <Ionicons name="home-outline" size={20} color="#630ed4" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.detailsTitle}>MESA {selectedTable.number}</Text>
            <Text style={styles.detailsSubtitle}>
              {activeOrder ? `Ocupada por ${activeOrder.clientName || 'Garçom'}` : 'Livre'}
            </Text>
          </View>
          <TouchableOpacity style={styles.detailsNewOrderBtn} onPress={() => setIsProductSelectorVisible(true)}>
            <Text style={styles.detailsNewOrderText}>NOVO PEDIDO</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailsSearchContainer}>
          <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
          <TextInput
            ref={searchInputRef}
            style={styles.detailsSearchInput}
            placeholder="Buscar produto..."
            placeholderTextColor="#888"
            value={searchTerm}
            onChangeText={handleSearch}
          />
        </View>

        {searchTerm !== '' && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultItem} onPress={() => openAddModal(item)}>
                  <Text style={styles.searchResultName}>{item.name}</Text>
                  <Text style={styles.searchResultPrice}>R$ {parseFloat(item.price).toFixed(2)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <Text style={styles.detailsListTitle}>Itens</Text>
        <ScrollView style={styles.detailsList}>
          {orderItems.map((item) => (
            <View key={item.id} style={styles.detailsListItem}>
              <View style={{ flex: 2 }}>
                <Text style={styles.detailsItemName}>{item.product?.name || item.Product?.name || 'Item'}</Text>
                {item.observation ? <Text style={{fontSize: 12, color: '#888', marginTop: 2}}>{item.observation}</Text> : null}
              </View>
              <Text style={styles.detailsItemQty}>x{item.quantity}</Text>
              <Text style={styles.detailsItemPrice}>R$ {(item.price * item.quantity).toFixed(2)}</Text>
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ marginLeft: 12 }}>
                <Ionicons name="trash-outline" size={20} color="#ba1a1a" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={styles.detailsFooter}>
          {(() => {
            const subtotal = activeOrder ? parseFloat(activeOrder.total || 0) : 0;
            const commission = subtotal * 0.10;
            const grandTotal = subtotal + commission;
            return (
              <>
                <View style={styles.detailsBreakdownRow}>
                  <Text style={styles.detailsBreakdownLabel}>Subtotal</Text>
                  <Text style={styles.detailsBreakdownValue}>R$ {subtotal.toFixed(2).replace('.', ',')}</Text>
                </View>
                <View style={styles.detailsBreakdownRow}>
                  <Text style={styles.detailsBreakdownLabel}>Comissão (10%)</Text>
                  <Text style={styles.detailsBreakdownCommission}>+ R$ {commission.toFixed(2).replace('.', ',')}</Text>
                </View>
                <View style={styles.detailsDivider} />
                <View style={styles.detailsTotalRow}>
                  <Text style={styles.detailsTotalLabel}>TOTAL GERAL</Text>
                  <Text style={styles.detailsFooterTotalValue}>R$ {grandTotal.toFixed(2).replace('.', ',')}</Text>
                </View>
              </>
            );
          })()}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[styles.detailsCloseBtn, { flex: 1 }]} onPress={handleRequestBill}>
              <Text style={styles.detailsCloseBtnText}>FECHAR MESA</Text>
            </TouchableOpacity>
          </View>
        </View>

        <QuantityModal isVisible={isQuantityModalVisible} product={selectedProductToAdd} onConfirm={handleConfirmAddProduct} onCancel={() => setIsQuantityModalVisible(false)} />
        <ProductSelectorModal isVisible={isProductSelectorVisible} onClose={() => setIsProductSelectorVisible(false)} onSelectProduct={openAddModal} products={products} />
        {isCloseModalVisible && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <CloseTableModal visible={isCloseModalVisible} onClose={() => setIsCloseModalVisible(false)} order={activeOrder} orderItems={orderItems} tableNum={selectedTable.number} onConfirm={handleConfirmClose} onPartialPayment={handlePartialPayment} />
          </View>
        )}
      </View>
    );
  }

  const handleLogin = async () => {
    if (!loginData.restaurantCode || !loginData.user || !loginData.password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    try {
      // Fazendo a verificação pelo Backend Node local mantendo o Supabase trancado!
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantSlug: loginData.restaurantCode,
          username: loginData.user,
          password: loginData.password,
        }),
      });

      if (!res.ok) {
        let errorMsg = 'Usuário, senha ou restaurante incorretos.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        Alert.alert('Acesso Negado', errorMsg);
        return;
      }

      const data = await res.json();
      const userToSave = data.user || data;
      setUserData(userToSave);
      setIsLoggedIn(true);
      
      // Salva sessão localmente para não deslogar no F5 ou ao recarregar a aba
      try {
        await AsyncStorage.setItem('@savora_session', JSON.stringify({ userData: userToSave }));
      } catch (e) {
        console.error('Erro ao salvar sessão local:', e);
      }

      Alert.alert('Sucesso', `Bem-vindo!`);

    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível conectar ao Supabase.');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@savora_session');
    } catch (err) {
      console.error('Erro ao remover sessão:', err);
    }
    setUserData(null);
    setIsLoggedIn(false);
    setActiveTab('tables');
  };

  if (isLoadingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: '#faf8ff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#630ed4" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8ff" />
        <View style={styles.loginCard}>

          <View style={styles.loginLogoContainer}>
            <Image
              source={require('./assets/images/savora-logo.png')}
              style={styles.loginLogoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.loginTitle}>Savora</Text>

          <Text style={styles.loginLabel}>Código do Restaurante</Text>
          <View style={[styles.loginInputWrapper, focusedInput === 'restaurantCode' && styles.loginInputWrapperFocused]}>
            <Ionicons name="storefront-outline" size={20} color={focusedInput === 'restaurantCode' ? "#630ed4" : "#7c3aed"} style={styles.loginIcon} />
            <TextInput
              style={styles.loginInput}
              placeholder={focusedInput === 'restaurantCode' ? "" : "Ex: BISTRO123"}
              placeholderTextColor="#7b7487"
              value={loginData.restaurantCode}
              onChangeText={(text) => setLoginData({ ...loginData, restaurantCode: text })}
              onFocus={() => setFocusedInput('restaurantCode')}
              onBlur={() => setFocusedInput(null)}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.loginLabel}>Usuário</Text>
          <View style={[styles.loginInputWrapper, focusedInput === 'user' && styles.loginInputWrapperFocused]}>
            <Ionicons name="person-outline" size={20} color={focusedInput === 'user' ? "#630ed4" : "#7c3aed"} style={styles.loginIcon} />
            <TextInput
              style={styles.loginInput}
              placeholder={focusedInput === 'user' ? "" : "Seu nome de usuário"}
              placeholderTextColor="#7b7487"
              value={loginData.user}
              onChangeText={(text) => setLoginData({ ...loginData, user: text })}
              onFocus={() => setFocusedInput('user')}
              onBlur={() => setFocusedInput(null)}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.loginLabel}>Senha</Text>
          <View style={[styles.loginInputWrapper, focusedInput === 'password' && styles.loginInputWrapperFocused]}>
            <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'password' ? "#630ed4" : "#7c3aed"} style={styles.loginIcon} />
            <TextInput
              style={styles.loginInput}
              placeholder={focusedInput === 'password' ? "" : "••••••••"}
              placeholderTextColor="#7b7487"
              secureTextEntry={!showPassword}
              value={loginData.password}
              onChangeText={(text) => setLoginData({ ...loginData, password: text })}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#7b7487" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
            <Text style={styles.loginBtnText}>ENTRAR</Text>
            <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <View style={styles.loginDivider} />

          <TouchableOpacity onPress={() => setIsChangePasswordModalVisible(true)} activeOpacity={0.7}>
            <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportContainer} activeOpacity={0.7}>
            <Ionicons name="headset-outline" size={16} color="#7b7487" style={{ marginRight: 6 }} />
            <Text style={styles.supportText}>Suporte TI</Text>
          </TouchableOpacity>

        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {activeTab === 'tables' && (
        <>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <Ionicons name="restaurant-outline" size={24} color="#7b7487" />
            <Text style={styles.logoText}>SAVORA</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setActiveTab('settings')}>
              <Ionicons name="person-circle-outline" size={28} color="#7b7487" />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={activeArea === 'MAIN' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveArea('MAIN')}
            >
              <Text style={activeArea === 'MAIN' ? styles.tabTextActive : styles.tabTextInactive}>Salão</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={activeArea === 'FRONT' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveArea('FRONT')}
            >
              <Text style={activeArea === 'FRONT' ? styles.tabTextActive : styles.tabTextInactive}>Frente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={activeArea === 'OUTSIDE' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveArea('OUTSIDE')}
            >
              <Text style={activeArea === 'OUTSIDE' ? styles.tabTextActive : styles.tabTextInactive}>Área</Text>
            </TouchableOpacity>
          </View>

          {/* Legend Container */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={styles.legendDotLivre} />
              <Text style={styles.legendText}>Livre</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDotOcupada} />
              <Text style={styles.legendText}>Ocupada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDotAguardando} />
              <Text style={styles.legendText}>Aguardando</Text>
            </View>
          </View>

          {/* Compact Tables Grid (3 Columns) */}
          <FlatList
            key={'3-columns'}
            data={allTables.filter(t => t.area === activeArea)}
            numColumns={3}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => {
              const order = activeOrders.find(o => o.tableNum === item.number);
              const status = getTableStatus(item);
              const formattedWait = getElapsedTime(order);

              const isFree = status === 'livre';
              const isAguardando = status === 'aguardando';

              return (
                <TouchableOpacity
                  style={[
                    styles.tableCard,
                    isFree
                      ? styles.tableCardFree
                      : isAguardando
                      ? styles.tableCardAguardando
                      : styles.tableCardOcupada
                  ]}
                  onPress={() => selectMainTable(item)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tableNum,
                      isFree ? styles.tableNumFree : styles.tableNumBusy
                    ]}
                  >
                    {item.number < 10 ? `0${item.number}` : item.number}
                  </Text>

                  {!isFree ? (
                    <View style={styles.tableBusyInfo}>
                      <Text style={styles.tableTotalBusy}>
                        R$ {(order ? ((parseFloat(order.total || 0) * 1.10) - (order.paidCash || 0) - (order.paidPix || 0) - (order.paidCard || 0)) : 0).toFixed(2).replace('.', ',')}
                      </Text>
                      <Text style={styles.tableClientName} numberOfLines={1}>
                        {order?.clientName || 'Garçom'}
                      </Text>
                      <View style={styles.timeBadgeContainer}>
                        <Ionicons name="time-outline" size={11} color="#4a4455" style={{ marginRight: 3 }} />
                        <Text style={styles.timeText}>
                          {isAguardando ? 'FECHANDO' : formattedWait}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.tableSubtitleFree}>LIVRE</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {activeTab === 'settings' && (
        <ScrollView style={styles.settingsScrollView} contentContainerStyle={styles.settingsContent}>
          {/* Settings Top Header */}
          <View style={styles.settingsTopHeader}>
            <Text style={styles.settingsHeaderLogo}>Savora</Text>
            <View style={styles.settingsHeaderIcons}>
              <TouchableOpacity style={styles.headerIconButton}>
                <Ionicons name="notifications-outline" size={22} color="#5c5f61" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconButton}>
                <Ionicons name="help-circle-outline" size={22} color="#5c5f61" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerIconButton, styles.headerIconActive]}>
                <Ionicons name="person-circle" size={24} color="#630ed4" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.settingsPageTitle}>Configurações</Text>

          {/* Profile Section */}
          <View style={styles.settingsCard}>
            <View style={styles.profileAvatarWrapper}>
              <Ionicons name="person" size={44} color="#630ed4" />
            </View>
            <Text style={styles.profileName}>{userData?.name || userData?.username || 'Moyses'}</Text>
            <Text style={styles.profileRole}>Garçom</Text>
            
            <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.editProfileBtnText}>Editar Perfil</Text>
            </TouchableOpacity>
          </View>

          {/* Appearance Section */}
          <View style={styles.settingsCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="color-palette-outline" size={20} color="#630ed4" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Aparência</Text>
                <Text style={styles.cardSubtitle}>Ajuste o tema do aplicativo.</Text>
              </View>
            </View>

            <View style={styles.settingItemRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sunny-outline" size={20} color="#131b2e" style={{ marginRight: 10 }} />
                <Text style={styles.settingItemText}>Modo Claro</Text>
              </View>
              <View style={styles.toggleTrackActive}>
                <View style={styles.toggleThumbActive} />
              </View>
            </View>
          </View>

          {/* Security Section */}
          <View style={styles.settingsCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#630ed4" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Segurança</Text>
                <Text style={styles.cardSubtitle}>Gerencie suas credenciais de acesso.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.outlineActionBtn} activeOpacity={0.8} onPress={() => setIsChangePasswordModalVisible(true)}>
              <Ionicons name="key-outline" size={18} color="#131b2e" style={{ marginRight: 8 }} />
              <Text style={styles.outlineActionBtnText}>Alterar Senha</Text>
            </TouchableOpacity>
          </View>

          {/* Commissions Section */}
          <View style={styles.settingsCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="wallet-outline" size={20} color="#630ed4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Comissões</Text>
                <Text style={styles.cardSubtitle}>Ganhos em Comissões (10%)</Text>
              </View>
              <TouchableOpacity style={styles.refreshBadgeBtn} onPress={() => fetchWaiterTips()} activeOpacity={0.7}>
                <Ionicons name="sync-outline" size={16} color="#630ed4" style={{ marginRight: 4 }} />
                <Text style={styles.refreshBadgeText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.commissionValue}>
              R$ {parseFloat(waiterTipsTotal || 0).toFixed(2).replace('.', ',')}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#ba1a1a" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Sair da Conta</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {activeTab === 'orders' && (
        <View style={{ flex: 1, backgroundColor: '#faf8ff' }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#131b2e' }}>Meus Pedidos Abertos</Text>
          </View>
          <FlatList
            data={activeOrders.filter(o => String(o.waiterId || o.waiter_id) === String(userData?.id || userData?.userId))}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.placeholderTabContainer}>
                <Ionicons name="receipt-outline" size={48} color="#ccc3d8" />
                <Text style={styles.placeholderTabSubtitle}>Você não tem nenhum pedido aberto no momento.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#630ed4' }}>Mesa {item.tableNum}</Text>
                    <Text style={{ fontSize: 13, color: '#5c5f61', marginTop: 2 }}>
                      {item.clientName || 'Cliente'} • {getElapsedTime(item)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#131b2e' }}>
                    R$ {parseFloat(item.total || 0).toFixed(2).replace('.', ',')}
                  </Text>
                </View>
                
                <View style={{ height: 1, backgroundColor: '#f2f3ff', marginBottom: 12 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: '#f2f3ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                    onPress={() => {
                      const table = allTables.find(t => t.number === item.tableNum);
                      if (table) {
                        selectMainTable(table);
                        setActiveTab('tables');
                      }
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color="#630ed4" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#630ed4', fontWeight: '600', fontSize: 13 }}>Ver Detalhes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: '#ffe5e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                    onPress={() => handleReprintKitchen(item.id, item.tableNum)}
                  >
                    <Ionicons name="print-outline" size={16} color="#ba1a1a" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#ba1a1a', fontWeight: '600', fontSize: 13 }}>Reimprimir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'alerts' && (
        <View style={styles.placeholderTabContainer}>
          <Ionicons name="notifications-outline" size={48} color="#7c3aed" />
          <Text style={styles.placeholderTabTitle}>Alertas</Text>
          <Text style={styles.placeholderTabSubtitle}>Notificações da cozinha e salão.</Text>
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={activeTab === 'tables' ? styles.navItemActive : styles.navItemInactive}
          onPress={() => setActiveTab('tables')}
        >
          <Ionicons name="grid" size={20} color={activeTab === 'tables' ? "#630ed4" : "#5c5f61"} />
          <Text style={activeTab === 'tables' ? styles.navTextActive : styles.navTextInactive}>Mesas</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={activeTab === 'orders' ? styles.navItemActive : styles.navItemInactive}
          onPress={() => setActiveTab('orders')}
        >
          <Ionicons name="receipt-outline" size={22} color={activeTab === 'orders' ? "#630ed4" : "#5c5f61"} />
          <Text style={activeTab === 'orders' ? styles.navTextActive : styles.navTextInactive}>Pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={activeTab === 'alerts' ? styles.navItemActive : styles.navItemInactive}
          onPress={() => setActiveTab('alerts')}
        >
          <Ionicons name="notifications-outline" size={22} color={activeTab === 'alerts' ? "#630ed4" : "#5c5f61"} />
          <Text style={activeTab === 'alerts' ? styles.navTextActive : styles.navTextInactive}>Alertas</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={activeTab === 'settings' ? styles.navItemActive : styles.navItemInactive}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons name="settings" size={20} color={activeTab === 'settings' ? "#630ed4" : "#5c5f61"} />
          <Text style={activeTab === 'settings' ? styles.navTextActive : styles.navTextInactive}>Configurações</Text>
        </TouchableOpacity>
      </View>

      <ChangePasswordModal
        isVisible={isChangePasswordModalVisible}
        onClose={() => setIsChangePasswordModalVisible(false)}
        onSave={handleChangePassword}
        userData={userData}
        API_URL={API_URL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#faf8ff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  loginCard: { backgroundColor: '#ffffff', paddingVertical: 36, paddingHorizontal: 28, borderRadius: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#eaedff', alignItems: 'center', shadowColor: '#732ee4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 3 },
  loginLogoContainer: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#eaddff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  loginLogoImage: { width: 56, height: 56 },
  loginTitle: { fontSize: 36, fontWeight: '700', color: '#131b2e', textAlign: 'center', marginBottom: 28, letterSpacing: -0.5 },
  loginLabel: { fontSize: 14, fontWeight: '600', color: '#4a4455', marginBottom: 6, width: '100%' },
  loginInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3ff', borderRadius: 12, borderWidth: 1, borderColor: '#dae2fd', marginBottom: 18, width: '100%', height: 52, paddingHorizontal: 16 },
  loginInputWrapperFocused: { borderColor: '#630ed4', borderWidth: 1.5, backgroundColor: '#ffffff' },
  loginIcon: { marginRight: 12 },
  loginInput: { flex: 1, color: '#131b2e', fontSize: 15, height: '100%', outlineStyle: 'none' },
  eyeBtn: { padding: 4 },
  loginBtn: { backgroundColor: '#630ed4', flexDirection: 'row', width: '100%', height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#630ed4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnText: { color: 'white', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  loginDivider: { height: 1, backgroundColor: '#eaedff', width: '100%', marginTop: 28, marginBottom: 20 },
  forgotPasswordText: { color: '#131b2e', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  supportContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  supportText: { color: '#4a4455', fontSize: 14, fontWeight: '500' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 12, backgroundColor: '#ffffff' },
  logoText: { color: '#630ed4', fontSize: 32, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  tabsContainer: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#ccc3d8', marginHorizontal: 20 },
  tabActive: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: '#630ed4', paddingHorizontal: 16 },
  tabInactive: { paddingVertical: 10, paddingHorizontal: 16 },
  tabTextActive: { color: '#630ed4', fontSize: 15, fontWeight: '600' },
  tabTextInactive: { color: '#5c5f61', fontSize: 15, fontWeight: '500' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingVertical: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDotLivre: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#7b7487', marginRight: 6 },
  legendDotOcupada: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c3aed', marginRight: 6 },
  legendDotAguardando: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffb784', marginRight: 6 },
  legendText: { color: '#4a4455', fontSize: 13, fontWeight: '500' },
  gridContent: { paddingHorizontal: 10, paddingBottom: 110 },
  tableCard: { flex: 1, margin: 5, aspectRatio: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#131b2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  tableCardFree: { borderWidth: 1, borderColor: '#ccc3d8' },
  tableCardOcupada: { borderWidth: 1, borderColor: '#ccc3d8', borderTopWidth: 4, borderTopColor: '#630ed4' },
  tableCardAguardando: { borderWidth: 1, borderColor: '#ccc3d8', borderTopWidth: 4, borderTopColor: '#ffb784' },
  tableNum: { fontSize: 22, fontWeight: '700' },
  tableNumFree: { color: '#5c5f61' },
  tableNumBusy: { color: '#630ed4' },
  tableSubtitleFree: { fontSize: 10, color: '#5c5f61', marginTop: 4, letterSpacing: 1, fontWeight: '600', textTransform: 'uppercase' },
  tableBusyInfo: { alignItems: 'center', marginTop: 2 },
  tableTotalBusy: { fontSize: 13, color: '#131b2e', fontWeight: '600' },
  tableClientName: { fontSize: 11, color: '#630ed4', marginTop: 1, fontWeight: '500' },
  timeBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  timeText: { fontSize: 11, color: '#4a4455', fontWeight: '500' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#ccc3d8', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 8 },
  navItemActive: { backgroundColor: '#eaddff', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  navItemInactive: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  navTextActive: { color: '#630ed4', fontSize: 11, fontWeight: '600', marginTop: 2 },
  navTextInactive: { color: '#5c5f61', fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Settings screen styles
  settingsScrollView: { flex: 1, backgroundColor: '#faf8ff' },
  settingsContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  settingsTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingsHeaderLogo: { fontSize: 24, fontWeight: '800', color: '#630ed4' },
  settingsHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconButton: { padding: 6, borderRadius: 20 },
  headerIconActive: { borderBottomWidth: 2, borderBottomColor: '#630ed4' },
  settingsPageTitle: { fontSize: 28, fontWeight: '700', color: '#131b2e', marginBottom: 20, letterSpacing: -0.5 },
  settingsCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  profileAvatarWrapper: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#eaedff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 4, borderColor: '#e2e7ff' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#131b2e', marginBottom: 2 },
  profileRole: { fontSize: 15, color: '#5c5f61', marginBottom: 16 },
  editProfileBtn: { backgroundColor: '#7c3aed', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  editProfileBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 },
  cardIconBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f2f3ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#131b2e' },
  cardSubtitle: { fontSize: 13, color: '#5c5f61', marginTop: 2 },
  settingItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: '#f2f3ff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#e0e3e5' },
  settingItemText: { fontSize: 14, fontWeight: '600', color: '#4a4455' },
  toggleTrackActive: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#630ed4', padding: 2, justifyContent: 'center', alignItems: 'flex-end' },
  toggleThumbActive: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff' },
  outlineActionBtn: { borderWidth: 1, borderColor: '#e0e3e5', borderRadius: 999, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  outlineActionBtnText: { fontSize: 14, fontWeight: '600', color: '#131b2e' },
  commissionValue: { fontSize: 26, fontWeight: '700', color: '#630ed4', width: '100%' },
  refreshBadgeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#dae2fd' },
  refreshBadgeText: { fontSize: 12, fontWeight: '600', color: '#630ed4' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 8 },
  logoutBtnText: { fontSize: 14, fontWeight: '600', color: '#ba1a1a' },
  placeholderTabContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  placeholderTabTitle: { fontSize: 24, fontWeight: '700', color: '#131b2e', marginTop: 12 },
  placeholderTabSubtitle: { fontSize: 14, color: '#5c5f61', textAlign: 'center', marginTop: 6 },
  detailsContainer: { flex: 1, backgroundColor: '#ffffff', paddingTop: 50 },
  detailsHeader: { flexDirection: 'row', paddingHorizontal: 20, alignItems: 'center', marginBottom: 20 },
  backHomeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#dae2fd' },
  detailsTitle: { fontSize: 28, fontWeight: 'bold', color: '#131b2e' },
  detailsSubtitle: { fontSize: 14, color: '#5c5f61' },
  detailsNewOrderBtn: { backgroundColor: '#630ed4', padding: 10, borderRadius: 8 },
  detailsNewOrderText: { fontWeight: 'bold', fontSize: 12, color: '#ffffff' },
  detailsSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3ff', marginHorizontal: 20, paddingHorizontal: 15, borderRadius: 8, height: 45, marginBottom: 20, borderWidth: 1, borderColor: '#dae2fd' },
  detailsSearchInput: { flex: 1, color: '#131b2e' },
  detailsListTitle: { color: '#131b2e', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 10 },
  detailsList: { flex: 1, paddingHorizontal: 20 },
  detailsListItem: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eaedff' },
  detailsItemName: { color: '#131b2e', fontSize: 15, fontWeight: 'bold' },
  detailsItemQty: { color: '#5c5f61', flex: 1, textAlign: 'center' },
  detailsItemPrice: { color: '#131b2e', flex: 1, textAlign: 'right' },
  detailsFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#eaedff' },
  detailsFooterTotalValue: { color: '#131b2e', fontSize: 32, fontWeight: 'bold', marginBottom: 15 },
  detailsCloseBtn: { backgroundColor: '#630ed4', height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  detailsCloseBtnText: { fontWeight: 'bold', fontSize: 16, color: '#ffffff' },
  detailsCancelBtn: { backgroundColor: '#ffe5e5', height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffb3b3' },
  detailsCancelBtnText: { fontWeight: 'bold', fontSize: 16, color: '#ba1a1a' },
  detailsBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailsBreakdownLabel: { fontSize: 14, color: '#5c5f61', fontWeight: '500' },
  detailsBreakdownValue: { fontSize: 14, color: '#131b2e', fontWeight: '600' },
  detailsBreakdownCommission: { fontSize: 14, color: '#630ed4', fontWeight: '600' },
  detailsDivider: { height: 1, backgroundColor: '#eaedff', marginVertical: 8 },
  detailsTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsTotalLabel: { fontSize: 16, fontWeight: '700', color: '#131b2e' },
  searchResultsContainer: { position: 'absolute', top: 180, left: 20, right: 20, backgroundColor: '#ffffff', zIndex: 10, borderRadius: 8, padding: 10, maxHeight: 200, borderWidth: 1, borderColor: '#dae2fd', elevation: 5 },
  searchResultItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eaedff', flexDirection: 'row', justifyContent: 'space-between' },
  searchResultName: { color: '#131b2e' },
  searchResultPrice: { color: '#630ed4', fontWeight: 'bold' }
});
