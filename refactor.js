const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace("import { CloseTableModal } from './components/CloseTableModal';", "import { CloseTableModal } from './components/CloseTableModal';\nimport { CustomAlertModal } from './components/CustomAlertModal';");

code = code.replace("export default function App() {", "export default function App() {\n  const [customAlertState, setCustomAlertState] = useState({ visible: false, title: '', message: '', isConfirm: false, onConfirm: () => {} });\n\n  const showAlert = (title, message) => setCustomAlertState({ visible: true, title, message, isConfirm: false, onConfirm: () => setCustomAlertState(p => ({ ...p, visible: false })) });\n  const showConfirm = (title, message, onConfirm) => setCustomAlertState({ visible: true, title, message, isConfirm: true, onConfirm: () => { setCustomAlertState(p => ({ ...p, visible: false })); onConfirm(); } });\n\n  const renderAlert = () => (\n    <CustomAlertModal\n      visible={customAlertState.visible}\n      title={customAlertState.title}\n      message={customAlertState.message}\n      isConfirm={customAlertState.isConfirm}\n      onConfirm={customAlertState.onConfirm}\n      onCancel={() => setCustomAlertState(p => ({ ...p, visible: false }))}\n    />\n  );");

code = code.replace("<View style={styles.loginCard}>", "<View style={styles.loginCard}>\n          {renderAlert()}");
code = code.replace("<View style={styles.container}>", "<View style={styles.container}>\n      {renderAlert()}");
code = code.replace("<View style={styles.detailsContainer}>", "<View style={styles.detailsContainer}>\n        {renderAlert()}");

const simpleAlerts = [
  ["Alert.alert('Erro', 'Não foi possível alterar a senha.');", "showAlert('Erro', 'Não foi possível alterar a senha.');"],
  ["Alert.alert('Sucesso', 'Item adicionado');", "showAlert('Sucesso', 'Item adicionado');"],
  ["Alert.alert('Erro', 'Falha ao adicionar item');", "showAlert('Erro', 'Falha ao adicionar item');"],
  ["Alert.alert('Erro', errMsg);", "showAlert('Erro', errMsg);"],
  ["Alert.alert('Sucesso', 'Mesa fechada e enviada para o caixa!');", "showAlert('Sucesso', 'Mesa fechada e enviada para o caixa!');"],
  ["Alert.alert('Erro', 'Falha na conexão com o servidor.');", "showAlert('Erro', 'Falha na conexão com o servidor.');"],
  ["Alert.alert('Sucesso', 'Mesa quitada e fechada com sucesso!');", "showAlert('Sucesso', 'Mesa quitada e fechada com sucesso!');"],
  ["Alert.alert('Sucesso', `Pagamento de R$ ${paymentData.amount.toFixed(2).replace('.', ',')} registrado com sucesso!`);", "showAlert('Sucesso', `Pagamento de R$ ${paymentData.amount.toFixed(2).replace('.', ',')} registrado com sucesso!`);"],
  ["window.alert('Item cancelado com sucesso!');", "showAlert('Aviso', 'Item cancelado com sucesso!');"],
  ["Alert.alert('Sucesso', 'Item cancelado com sucesso!');", "showAlert('Sucesso', 'Item cancelado com sucesso!');"],
  ["window.alert(err.message);", "showAlert('Aviso', String(err.message));"],
  ["Alert.alert('Erro', err.message);", "showAlert('Erro', String(err.message));"],
  ["Alert.alert('Sucesso', 'Pedido excluído permanentemente!');", "showAlert('Sucesso', 'Pedido excluído permanentemente!');"],
  ["Alert.alert('Erro', 'Por favor, preencha todos os campos.');", "showAlert('Erro', 'Por favor, preencha todos os campos.');"],
  ["Alert.alert('Acesso Negado', errorMsg);", "showAlert('Acesso Negado', String(errorMsg));"],
  ["Alert.alert('Sucesso', `Bem-vindo!`);", "showAlert('Sucesso', `Bem-vindo!`);"],
  ["Alert.alert('Erro', 'Não foi possível conectar ao Supabase.');", "showAlert('Erro', 'Não foi possível conectar ao Supabase.');"]
];

for (const [find, replace] of simpleAlerts) {
    code = code.split(find).join(replace);
}

fs.writeFileSync('App.tsx', code, 'utf8');
