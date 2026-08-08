import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const API_URL = "https://savora-6m9q.onrender.com";

export const ProductSelectorModal = ({ isVisible, onClose, onSelectProduct, restaurantId }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isVisible) {
            fetchData();
        }
    }, [isVisible]);

    const fetchData = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/products?rid=${restaurantId}`);
            if (res.ok) {
                const prodData = await res.json();
                setProducts(prodData || []);

                // Extrai categorias unicas baseadas nos produtos
                const catsMap = new Map();
                prodData.forEach(p => {
                    if (p.categoryId && p.category) {
                        catsMap.set(p.categoryId, p.category.name);
                    }
                });

                const uniqueCats = Array.from(catsMap, ([id, name]) => ({ id, name }));
                setCategories([{ id: 'all', name: 'Todos' }, ...uniqueCats]);
            }
        } catch (error) {
            console.error('Error fetching selector data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        filterProducts();
    }, [searchTerm, selectedCategory, products]);

    const filterProducts = () => {
        let filtered = products;

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.categoryId === selectedCategory);
        }

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        setFilteredProducts(filtered);
    };

    if (!isVisible) return null;

    const renderCategoryItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.categoryBtn, selectedCategory === item.id && styles.categoryBtnActive]}
            onPress={() => setSelectedCategory(item.id)}
        >
            <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>{item.name}</Text>
        </TouchableOpacity>
    );

    const renderProductItem = ({ item }) => (
        <TouchableOpacity style={styles.productCard} onPress={() => onSelectProduct(item)}>
            <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>R$ {parseFloat(item.price).toFixed(2)}</Text>
            </View>
            <Ionicons name="add-circle" size={30} color="#5A18E6" />
        </TouchableOpacity>
    );

    return (
        <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Cardápio</Text>
                    <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#888" />
                    <TextInput style={styles.searchInput} placeholder="Buscar..." value={searchTerm} onChangeText={setSearchTerm} />
                </View>

                <View style={{ height: 60 }}>
                    <FlatList data={categories} renderItem={renderCategoryItem} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, gap: 10 }} />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#5A18E6" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList data={filteredProducts} renderItem={renderProductItem} keyExtractor={item => item.id} contentContainerStyle={{ padding: 15 }} />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
    title: { fontSize: 20, fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', margin: 15, paddingHorizontal: 15, borderRadius: 10, height: 45 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
    categoryBtn: { paddingHorizontal: 20, height: 40, justifyContent: 'center', borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD' },
    categoryBtnActive: { backgroundColor: '#5A18E6', borderColor: '#5A18E6' },
    categoryText: { fontWeight: '600', color: '#666' },
    categoryTextActive: { color: '#FFF' },
    productCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    productName: { fontSize: 16, fontWeight: 'bold' },
    productPrice: { color: '#5A18E6', fontWeight: 'bold', marginTop: 4 }
});
