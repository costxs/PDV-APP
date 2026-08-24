const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

const target1 = `  const handleDeleteItem = (itemId) => {
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
  };`;

const replacement1 = `  const handleDeleteItem = (itemId) => {
    showConfirm('Cancelar Item', 'Tem certeza que deseja cancelar este item do pedido?', () => performDeletion(itemId));
  };`;

code = code.replace(target1, replacement1);

const target2 = `  const handleCancelOrder = () => {
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
              const res = await fetch(\`\${API_URL}/orders/\${activeOrder.id}\`, {
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
              showAlert('Sucesso', 'Pedido excluído permanentemente!');
            } catch (err) {
              console.error(err);
              showAlert('Erro', String(err.message));
            }
          }
        }
      ]
    );
  };`;

const replacement2 = `  const handleCancelOrder = () => {
    if (!activeOrder) return;
    showConfirm('Cancelar Pedido Inteiro', 'Tem certeza que deseja cancelar TODO o pedido? Esta ação excluirá a mesa.', async () => {
      try {
        const res = await fetch(\`\${API_URL}/orders/\${activeOrder.id}\`, {
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
        showAlert('Sucesso', 'Pedido excluído permanentemente!');
      } catch (err) {
        console.error(err);
        showAlert('Erro', String(err.message));
      }
    });
  };`;

code = code.replace(target2, replacement2);

fs.writeFileSync('App.tsx', code, 'utf8');
console.log("Custom confirm script run.");
