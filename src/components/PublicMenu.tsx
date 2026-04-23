import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { compareMenuItemsInCategory, orderMenuItemsByCategoryList } from '../lib/menuItemSort';
import {
  Plus,
  Minus,
  ShoppingCart,
  X,
  ChefHat,
  Coffee,
  Send,
  Check,
  Loader2,
  Bell,
  Clock,
  Phone,
  Star,
  ArrowLeft,
  HelpCircle,
  Globe,
  UtensilsCrossed,
  Wine
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── i18n ───────────────────────────────────────────────────
type Lang = 'pt' | 'en' | 'fr' | 'de' | 'es';

const LANG_LABELS: Record<Lang, string> = { pt: 'PT', en: 'EN', fr: 'FR', de: 'DE', es: 'ES' };

const T: Record<Lang, Record<string, string>> = {
  pt: {
    loading: 'A carregar menu...',
    menuNotFound: 'Menu não encontrado',
    clubUnavailable: 'O clube solicitado não está disponível.',
    menu: 'MENU',
    drinks: 'Bebidas',
    food: 'Comida',
    item: 'item',
    items: 'itens',
    noMenu: 'Menu não disponível',
    noItems: 'Sem itens nesta categoria',
    add: 'Adicionar',
    viewOrder: 'Ver Pedido',
    yourOrder: 'O Seu Pedido',
    table: 'Mesa',
    counter: 'Balcão',
    tableNumber: 'Número da mesa',
    name: 'Nome',
    yourName: 'O seu nome',
    phone: 'Telemóvel (opcional)',
    phonePlaceholder: '+351 912 345 678',
    member: 'Membro',
    registeredPlayer: 'Jogador registado',
    noAccountFound: 'Nenhuma conta encontrada com este número.',
    phoneDiscount: 'Se já és cliente do clube, coloca o teu telemóvel para usufruíres de descontos!',
    notes: 'Observações (opcional)',
    notesPlaceholder: 'Alergias, preferências...',
    subtotal: 'Subtotal',
    memberDiscount: 'Desconto Membro',
    total: 'Total',
    sendOrder: 'Enviar Pedido',
    sending: 'A enviar pedido...',
    orderError: 'Erro ao enviar pedido. Tente novamente.',
    orderSent: 'Pedido Enviado',
    preparing: 'Em Preparação',
    readyPickup: 'Pronto para levantar!',
    delivered: 'Entregue',
    sent: 'Enviado',
    accepted: 'Aceite',
    ready: 'Pronto',
    waitingConfirm: 'A aguardar confirmação do bar...',
    preparingMsg: 'O seu pedido está a ser preparado!',
    readyMsg: 'O seu pedido está pronto! Pode vir buscar ao bar.',
    deliveredMsg: 'Obrigado! Bom apetite!',
    keepPage: 'Mantenha esta página aberta — será notificado quando o seu pedido estiver pronto.',
    newOrder: 'Fazer Novo Pedido',
    orderReady: 'Pedido Pronto!',
    orderReadyMsg: 'O seu pedido está pronto.',
    pickupBar: 'Pode vir buscar ao bar!',
    okThanks: 'OK, obrigado!',
    howToOrder: 'Como fazer o seu pedido',
    howToOrderStep1: 'Escolha a categoria (Bebidas ou Comida)',
    howToOrderStep2: 'Adicione os items ao seu pedido',
    howToOrderStep3: 'Clique em "Ver Pedido" para rever',
    howToOrderStep4: 'Preencha o seu nome e mesa',
    howToOrderStep5: 'Clique em "Enviar Pedido"',
    howToOrderStep6: 'Acompanhe o estado — será notificado quando estiver pronto!',
    close: 'Fechar',
  },
  en: {
    loading: 'Loading menu...',
    menuNotFound: 'Menu not found',
    clubUnavailable: 'The requested club is not available.',
    menu: 'MENU',
    drinks: 'Drinks',
    food: 'Food',
    item: 'item',
    items: 'items',
    noMenu: 'Menu not available',
    noItems: 'No items in this category',
    add: 'Add',
    viewOrder: 'View Order',
    yourOrder: 'Your Order',
    table: 'Table',
    counter: 'Counter',
    tableNumber: 'Table number',
    name: 'Name',
    yourName: 'Your name',
    phone: 'Phone (optional)',
    phonePlaceholder: '+351 912 345 678',
    member: 'Member',
    registeredPlayer: 'Registered player',
    noAccountFound: 'No account found with this number.',
    phoneDiscount: 'If you are a club member, enter your phone number to enjoy discounts!',
    notes: 'Notes (optional)',
    notesPlaceholder: 'Allergies, preferences...',
    subtotal: 'Subtotal',
    memberDiscount: 'Member Discount',
    total: 'Total',
    sendOrder: 'Send Order',
    sending: 'Sending order...',
    orderError: 'Error sending order. Please try again.',
    orderSent: 'Order Sent',
    preparing: 'Preparing',
    readyPickup: 'Ready for pickup!',
    delivered: 'Delivered',
    sent: 'Sent',
    accepted: 'Accepted',
    ready: 'Ready',
    waitingConfirm: 'Waiting for bar confirmation...',
    preparingMsg: 'Your order is being prepared!',
    readyMsg: 'Your order is ready! Please pick it up at the bar.',
    deliveredMsg: 'Thank you! Enjoy!',
    keepPage: 'Keep this page open — you will be notified when your order is ready.',
    newOrder: 'Place New Order',
    orderReady: 'Order Ready!',
    orderReadyMsg: 'Your order is ready.',
    pickupBar: 'Please pick it up at the bar!',
    okThanks: 'OK, thanks!',
    howToOrder: 'How to place your order',
    howToOrderStep1: 'Choose a category (Drinks or Food)',
    howToOrderStep2: 'Add items to your order',
    howToOrderStep3: 'Tap "View Order" to review',
    howToOrderStep4: 'Fill in your name and table',
    howToOrderStep5: 'Tap "Send Order"',
    howToOrderStep6: 'Track the status — you\'ll be notified when it\'s ready!',
    close: 'Close',
  },
  fr: {
    loading: 'Chargement du menu...',
    menuNotFound: 'Menu introuvable',
    clubUnavailable: 'Le club demandé n\'est pas disponible.',
    menu: 'MENU',
    drinks: 'Boissons',
    food: 'Nourriture',
    item: 'article',
    items: 'articles',
    noMenu: 'Menu non disponible',
    noItems: 'Aucun article dans cette catégorie',
    add: 'Ajouter',
    viewOrder: 'Voir Commande',
    yourOrder: 'Votre Commande',
    table: 'Table',
    counter: 'Comptoir',
    tableNumber: 'Numéro de table',
    name: 'Nom',
    yourName: 'Votre nom',
    phone: 'Téléphone (optionnel)',
    phonePlaceholder: '+351 912 345 678',
    member: 'Membre',
    registeredPlayer: 'Joueur enregistré',
    noAccountFound: 'Aucun compte trouvé avec ce numéro.',
    phoneDiscount: 'Si vous êtes membre du club, entrez votre téléphone pour profiter des réductions !',
    notes: 'Remarques (optionnel)',
    notesPlaceholder: 'Allergies, préférences...',
    subtotal: 'Sous-total',
    memberDiscount: 'Réduction Membre',
    total: 'Total',
    sendOrder: 'Envoyer Commande',
    sending: 'Envoi de la commande...',
    orderError: 'Erreur d\'envoi. Veuillez réessayer.',
    orderSent: 'Commande Envoyée',
    preparing: 'En Préparation',
    readyPickup: 'Prête à récupérer !',
    delivered: 'Livrée',
    sent: 'Envoyée',
    accepted: 'Acceptée',
    ready: 'Prête',
    waitingConfirm: 'En attente de confirmation du bar...',
    preparingMsg: 'Votre commande est en préparation !',
    readyMsg: 'Votre commande est prête ! Venez la chercher au bar.',
    deliveredMsg: 'Merci ! Bon appétit !',
    keepPage: 'Gardez cette page ouverte — vous serez notifié quand votre commande sera prête.',
    newOrder: 'Nouvelle Commande',
    orderReady: 'Commande Prête !',
    orderReadyMsg: 'Votre commande est prête.',
    pickupBar: 'Venez la chercher au bar !',
    okThanks: 'OK, merci !',
    howToOrder: 'Comment passer votre commande',
    howToOrderStep1: 'Choisissez une catégorie (Boissons ou Nourriture)',
    howToOrderStep2: 'Ajoutez des articles à votre commande',
    howToOrderStep3: 'Appuyez sur « Voir Commande » pour vérifier',
    howToOrderStep4: 'Renseignez votre nom et votre table',
    howToOrderStep5: 'Appuyez sur « Envoyer Commande »',
    howToOrderStep6: 'Suivez le statut — vous serez notifié quand ce sera prêt !',
    close: 'Fermer',
  },
  de: {
    loading: 'Menü wird geladen...',
    menuNotFound: 'Menü nicht gefunden',
    clubUnavailable: 'Der angeforderte Club ist nicht verfügbar.',
    menu: 'MENÜ',
    drinks: 'Getränke',
    food: 'Essen',
    item: 'Artikel',
    items: 'Artikel',
    noMenu: 'Menü nicht verfügbar',
    noItems: 'Keine Artikel in dieser Kategorie',
    add: 'Hinzufügen',
    viewOrder: 'Bestellung ansehen',
    yourOrder: 'Ihre Bestellung',
    table: 'Tisch',
    counter: 'Theke',
    tableNumber: 'Tischnummer',
    name: 'Name',
    yourName: 'Ihr Name',
    phone: 'Telefon (optional)',
    phonePlaceholder: '+351 912 345 678',
    member: 'Mitglied',
    registeredPlayer: 'Registrierter Spieler',
    noAccountFound: 'Kein Konto mit dieser Nummer gefunden.',
    phoneDiscount: 'Wenn Sie Clubmitglied sind, geben Sie Ihre Telefonnummer ein, um Rabatte zu erhalten!',
    notes: 'Anmerkungen (optional)',
    notesPlaceholder: 'Allergien, Präferenzen...',
    subtotal: 'Zwischensumme',
    memberDiscount: 'Mitgliederrabatt',
    total: 'Gesamt',
    sendOrder: 'Bestellung senden',
    sending: 'Bestellung wird gesendet...',
    orderError: 'Fehler beim Senden. Bitte erneut versuchen.',
    orderSent: 'Bestellung gesendet',
    preparing: 'In Zubereitung',
    readyPickup: 'Abholbereit!',
    delivered: 'Geliefert',
    sent: 'Gesendet',
    accepted: 'Angenommen',
    ready: 'Bereit',
    waitingConfirm: 'Warten auf Bestätigung der Bar...',
    preparingMsg: 'Ihre Bestellung wird zubereitet!',
    readyMsg: 'Ihre Bestellung ist fertig! Bitte an der Bar abholen.',
    deliveredMsg: 'Danke! Guten Appetit!',
    keepPage: 'Lassen Sie diese Seite offen — Sie werden benachrichtigt, wenn Ihre Bestellung fertig ist.',
    newOrder: 'Neue Bestellung',
    orderReady: 'Bestellung fertig!',
    orderReadyMsg: 'Ihre Bestellung ist fertig.',
    pickupBar: 'Bitte an der Bar abholen!',
    okThanks: 'OK, danke!',
    howToOrder: 'So bestellen Sie',
    howToOrderStep1: 'Wählen Sie eine Kategorie (Getränke oder Essen)',
    howToOrderStep2: 'Fügen Sie Artikel zu Ihrer Bestellung hinzu',
    howToOrderStep3: 'Tippen Sie auf „Bestellung ansehen" zur Prüfung',
    howToOrderStep4: 'Geben Sie Ihren Namen und Tisch ein',
    howToOrderStep5: 'Tippen Sie auf „Bestellung senden"',
    howToOrderStep6: 'Verfolgen Sie den Status — Sie werden benachrichtigt, wenn es fertig ist!',
    close: 'Schließen',
  },
  es: {
    loading: 'Cargando menú...',
    menuNotFound: 'Menú no encontrado',
    clubUnavailable: 'El club solicitado no está disponible.',
    menu: 'MENÚ',
    drinks: 'Bebidas',
    food: 'Comida',
    item: 'artículo',
    items: 'artículos',
    noMenu: 'Menú no disponible',
    noItems: 'Sin artículos en esta categoría',
    add: 'Añadir',
    viewOrder: 'Ver Pedido',
    yourOrder: 'Su Pedido',
    table: 'Mesa',
    counter: 'Barra',
    tableNumber: 'Número de mesa',
    name: 'Nombre',
    yourName: 'Su nombre',
    phone: 'Teléfono (opcional)',
    phonePlaceholder: '+34 612 345 678',
    member: 'Miembro',
    registeredPlayer: 'Jugador registrado',
    noAccountFound: 'Ninguna cuenta encontrada con este número.',
    phoneDiscount: 'Si eres miembro del club, introduce tu teléfono para disfrutar de descuentos!',
    notes: 'Observaciones (opcional)',
    notesPlaceholder: 'Alergias, preferencias...',
    subtotal: 'Subtotal',
    memberDiscount: 'Descuento Miembro',
    total: 'Total',
    sendOrder: 'Enviar Pedido',
    sending: 'Enviando pedido...',
    orderError: 'Error al enviar el pedido. Inténtelo de nuevo.',
    orderSent: 'Pedido Enviado',
    preparing: 'En Preparación',
    readyPickup: '¡Listo para recoger!',
    delivered: 'Entregado',
    sent: 'Enviado',
    accepted: 'Aceptado',
    ready: 'Listo',
    waitingConfirm: 'Esperando confirmación del bar...',
    preparingMsg: '¡Su pedido se está preparando!',
    readyMsg: '¡Su pedido está listo! Puede recogerlo en la barra.',
    deliveredMsg: '¡Gracias! ¡Buen provecho!',
    keepPage: 'Mantenga esta página abierta — será notificado cuando su pedido esté listo.',
    newOrder: 'Hacer Nuevo Pedido',
    orderReady: '¡Pedido Listo!',
    orderReadyMsg: 'Su pedido está listo.',
    pickupBar: '¡Puede recogerlo en la barra!',
    okThanks: '¡OK, gracias!',
    howToOrder: 'Cómo hacer su pedido',
    howToOrderStep1: 'Elija una categoría (Bebidas o Comida)',
    howToOrderStep2: 'Añada artículos a su pedido',
    howToOrderStep3: 'Pulse "Ver Pedido" para revisar',
    howToOrderStep4: 'Rellene su nombre y mesa',
    howToOrderStep5: 'Pulse "Enviar Pedido"',
    howToOrderStep6: '¡Siga el estado — será notificado cuando esté listo!',
    close: 'Cerrar',
  },
};

function detectLang(): Lang {
  const nav = navigator.language?.toLowerCase() || '';
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

// ─── Types ──────────────────────────────────────────────────
interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_food: boolean;
  is_highlighted?: boolean;
  sort_order?: number;
  kitchen_slot1_start?: string | null;
  kitchen_slot1_end?: string | null;
  kitchen_slot2_start?: string | null;
  kitchen_slot2_end?: string | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url_1: string | null;
  photo_url_2: string | null;
  owner_id: string;
}

interface PublicMenuProps {
  clubId: string;
  tableNumber: string | null;
}

const isItemInKitchenSchedule = (item: MenuItem): boolean => {
  if (!item.is_food) return true;
  if (!item.kitchen_slot1_start || !item.kitchen_slot1_end) return true;

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const inSlot = (start: string, end: string) => hhmm >= start.slice(0, 5) && hhmm <= end.slice(0, 5);

  if (inSlot(item.kitchen_slot1_start, item.kitchen_slot1_end)) return true;
  if (item.kitchen_slot2_start && item.kitchen_slot2_end) {
    if (inSlot(item.kitchen_slot2_start, item.kitchen_slot2_end)) return true;
  }
  return false;
};

// ─── Component ──────────────────────────────────────────────
export default function PublicMenu({ clubId, tableNumber }: PublicMenuProps) {
  const [lang, setLang] = useState<Lang>(detectLang);
  const t = T[lang];

  const [club, setClub] = useState<Club | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneLookupResult, setPhoneLookupResult] = useState<{ found: boolean; name: string | null; source: string | null; discount: number; playerAccountId: string | null } | null>(null);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const phoneLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'drinks' | 'food' | null>(null);
  const [mesa, setMesa] = useState(tableNumber || '');
  const [orderReady, setOrderReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadMenu();
  }, [clubId]);

  useEffect(() => {
    if (!orderId) return;

    const channel = anonSupabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'club_orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus) {
            setOrderStatus(newStatus);
            if (newStatus === 'ready') {
              setOrderReady(true);
              try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.value = 0.3;
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
                setTimeout(() => {
                  const osc2 = ctx.createOscillator();
                  const gain2 = ctx.createGain();
                  osc2.connect(gain2);
                  gain2.connect(ctx.destination);
                  osc2.frequency.value = 1100;
                  gain2.gain.value = 0.3;
                  osc2.start();
                  osc2.stop(ctx.currentTime + 0.5);
                }, 600);
              } catch {
                // Audio not supported
              }
              if (navigator.vibrate) {
                navigator.vibrate([300, 200, 300, 200, 300]);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      anonSupabase.removeChannel(channel);
    };
  }, [orderId]);

  const loadMenu = async () => {
    setLoading(true);

    const { data: clubData } = await anonSupabase
      .from('clubs')
      .select('id, name, logo_url, photo_url_1, photo_url_2, owner_id')
      .eq('id', clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (!clubData) {
      setLoading(false);
      return;
    }

    setClub(clubData);

    const { data: categoriesData } = await anonSupabase
      .from('menu_categories')
      .select('id, name, sort_order')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_active', true)
      .order('sort_order');

    const { data: itemsData } = await anonSupabase
      .from('menu_items')
      .select('*')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_available', true)
      .order('sort_order');

    const catList = categoriesData || [];
    const itemsSorted = orderMenuItemsByCategoryList(
      catList,
      (itemsData || []) as { id: string; category_id: string; name: string; sort_order?: number | null }[]
    );

    setCategories(catList);
    setMenuItems(itemsSorted);
    setSelectedCategory(null);
    setSelectedSection(null);
    setLoading(false);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter(c => c.menuItem.id !== itemId);
    });
  };

  const getCartQuantity = (itemId: string) => {
    return cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.quantity * c.menuItem.price, 0);

  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\s+/g, '').trim();
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
    if (!cleaned.startsWith('+') && cleaned.length === 9) cleaned = '+351' + cleaned;
    return cleaned;
  };

  const handlePhoneLookup = async (phone: string) => {
    if (!club || phone.replace(/\s+/g, '').length < 6) {
      setPhoneLookupResult(null);
      return;
    }

    setLookingUpPhone(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      const { data: playerAccount } = await anonSupabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      const { data: memberSub } = await anonSupabase
        .from('member_subscriptions')
        .select('member_name, member_phone, status, player_account_id, plan:membership_plans(name, bar_discount_percent)')
        .eq('club_owner_id', club.owner_id)
        .eq('member_phone', normalizedPhone)
        .eq('status', 'active')
        .maybeSingle();

      let memberSubByAccount = null;
      if (!memberSub && playerAccount) {
        const { data } = await anonSupabase
          .from('member_subscriptions')
          .select('member_name, member_phone, status, player_account_id, plan:membership_plans(name, bar_discount_percent)')
          .eq('club_owner_id', club.owner_id)
          .eq('player_account_id', playerAccount.id)
          .eq('status', 'active')
          .maybeSingle();
        memberSubByAccount = data;
      }

      const activeMember = memberSub || memberSubByAccount;

      if (activeMember) {
        const discount = (activeMember.plan as any)?.bar_discount_percent || 0;
        const planName = (activeMember.plan as any)?.name || '';
        setPhoneLookupResult({
          found: true,
          name: activeMember.member_name || playerAccount?.name || null,
          source: `${t.member} — ${planName}`,
          discount,
          playerAccountId: playerAccount?.id || activeMember.player_account_id || null
        });
        const foundName = activeMember.member_name || playerAccount?.name;
        if (!customerName.trim() && foundName) {
          setCustomerName(foundName);
        }
      } else if (playerAccount) {
        setPhoneLookupResult({
          found: true,
          name: playerAccount.name,
          source: t.registeredPlayer,
          discount: 0,
          playerAccountId: playerAccount.id
        });
        if (!customerName.trim() && playerAccount.name) {
          setCustomerName(playerAccount.name);
        }
      } else {
        setPhoneLookupResult({ found: false, name: null, source: null, discount: 0, playerAccountId: null });
      }
    } catch (err) {
      console.error('Phone lookup error:', err);
      setPhoneLookupResult(null);
    }

    setLookingUpPhone(false);
  };

  const handlePhoneChange = (phone: string) => {
    setCustomerPhone(phone);
    setPhoneLookupResult(null);
    if (phoneLookupTimeout.current) clearTimeout(phoneLookupTimeout.current);
    if (phone.replace(/\s+/g, '').length >= 6) {
      phoneLookupTimeout.current = setTimeout(() => handlePhoneLookup(phone), 500);
    }
  };

  const discountPercent = phoneLookupResult?.discount || 0;
  const totalPriceWithDiscount = discountPercent > 0
    ? totalPrice * (1 - discountPercent / 100)
    : totalPrice;

  const handleSubmitOrder = async () => {
    if (!club || !mesa.trim() || !customerName.trim() || cart.length === 0) return;

    setSubmitting(true);

    const { data: orderData, error: orderError } = await anonSupabase
      .from('club_orders')
      .insert({
        club_id: club.id,
        club_owner_id: club.owner_id,
        table_number: mesa.trim(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        notes: discountPercent > 0
          ? `${orderNotes.trim() ? orderNotes.trim() + ' | ' : ''}🏷️ ${t.member} -${discountPercent}%`
          : (orderNotes.trim() || null),
        total: totalPriceWithDiscount,
        status: 'pending',
        source: 'qr'
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      console.error('Error creating order:', orderError);
      alert(t.orderError);
      setSubmitting(false);
      return;
    }

    const items = cart.map(c => {
      const unitPrice = discountPercent > 0
        ? Math.round(c.menuItem.price * (1 - discountPercent / 100) * 100) / 100
        : c.menuItem.price;
      return {
        order_id: orderData.id,
        menu_item_id: c.menuItem.id,
        item_name: c.menuItem.name,
        quantity: c.quantity,
        unit_price: unitPrice,
        is_food: c.menuItem.is_food,
        notes: c.notes.trim() || null,
        status: 'pending'
      };
    });

    const { error: itemsError } = await anonSupabase
      .from('club_order_items')
      .insert(items);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          userId: club.owner_id,
          type: 'qr_order',
          bookingId: orderData.id,
          playerName: `${customerName.trim()} — ${t.table} ${mesa}`,
          courtName: `${t.table} ${mesa}`,
          scheduledAt: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('Could not send notification:', err);
    }

    setOrderId(orderData.id);
    setOrderStatus('pending');
    setOrderSubmitted(true);
    setOrderReady(false);
    setCart([]);
    setShowCart(false);
    setSubmitting(false);
  };

  // ─── Derived data ─────────────────────────────────────────
  const availableItems = menuItems.filter(isItemInKitchenSchedule);

  const drinkCategories = useMemo(() => {
    return categories.filter(cat =>
      availableItems.some(it => it.category_id === cat.id && !it.is_food)
    );
  }, [categories, availableItems]);

  const foodCategories = useMemo(() => {
    return categories.filter(cat =>
      availableItems.some(it => it.category_id === cat.id && it.is_food)
    );
  }, [categories, availableItems]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return availableItems;
    const base = availableItems.filter((i) => i.category_id === selectedCategory);
    return [...base].sort(compareMenuItemsInCategory);
  }, [selectedCategory, availableItems]);

  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name || '';

  const getCategoryItemCount = (catId: string, foodOnly?: boolean) => {
    return availableItems.filter(i => {
      if (i.category_id !== catId) return false;
      if (foodOnly === true) return i.is_food;
      if (foodOnly === false) return !i.is_food;
      return true;
    }).length;
  };

  const getCategoryHighlights = (catId: string, foodOnly?: boolean) => {
    return availableItems.filter(i => {
      if (i.category_id !== catId || !i.is_highlighted) return false;
      if (foodOnly === true) return i.is_food;
      if (foodOnly === false) return !i.is_food;
      return true;
    });
  };

  const mesaLabel = mesa === 'Balcão' ? t.counter : `${t.table} ${mesa}`;

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 mb-2">{t.menuNotFound}</p>
          <p className="text-gray-500">{t.clubUnavailable}</p>
        </div>
      </div>
    );
  }

  // ─── Order tracking ───────────────────────────────────────
  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {orderReady && (
            <div className="fixed inset-0 bg-emerald-600/95 z-50 flex items-center justify-center p-6 animate-pulse">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <Bell className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">🎉 {t.orderReady}</h2>
                <p className="text-xl mb-2">{t.orderReadyMsg}</p>
                <p className="text-lg mb-8 opacity-90">{t.pickupBar}</p>
                <button
                  onClick={() => setOrderReady(false)}
                  className="px-8 py-3 bg-white text-emerald-700 rounded-xl font-bold text-lg hover:bg-gray-100 transition"
                >
                  {t.okThanks} 👍
                </button>
              </div>
            </div>
          )}

          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            orderStatus === 'pending' ? 'bg-amber-100' :
            orderStatus === 'preparing' ? 'bg-blue-100' :
            orderStatus === 'ready' ? 'bg-emerald-100' :
            orderStatus === 'delivered' ? 'bg-gray-100' : 'bg-emerald-100'
          }`}>
            {orderStatus === 'pending' && <Clock className="w-10 h-10 text-amber-600 animate-pulse" />}
            {orderStatus === 'preparing' && <ChefHat className="w-10 h-10 text-blue-600 animate-bounce" />}
            {orderStatus === 'ready' && <Bell className="w-10 h-10 text-emerald-600 animate-bounce" />}
            {orderStatus === 'delivered' && <Check className="w-10 h-10 text-gray-600" />}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {orderStatus === 'pending' && `⏳ ${t.orderSent}`}
            {orderStatus === 'preparing' && `👨‍🍳 ${t.preparing}`}
            {orderStatus === 'ready' && `🔔 ${t.readyPickup}`}
            {orderStatus === 'delivered' && `✅ ${t.delivered}`}
          </h2>

          <p className="text-gray-600 mb-2">
            <strong>{mesaLabel}</strong> — {customerName}
          </p>

          <div className="my-6">
            <div className="flex items-center gap-1">
              <div className={`flex-1 h-2 rounded-full ${['pending', 'preparing', 'ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-2 rounded-full ${['preparing', 'ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-2 rounded-full ${['ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-2 rounded-full ${orderStatus === 'delivered' ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">{t.sent}</span>
              <span className="text-xs text-gray-500">{t.accepted}</span>
              <span className="text-xs text-gray-500">{t.ready}</span>
              <span className="text-xs text-gray-500">{t.delivered}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            {orderStatus === 'pending' && t.waitingConfirm}
            {orderStatus === 'preparing' && `${t.preparingMsg} 🍹`}
            {orderStatus === 'ready' && `${t.readyMsg} 🎉`}
            {orderStatus === 'delivered' && `${t.deliveredMsg} 😄`}
          </p>

          <p className="text-xs text-gray-400 mb-4">💡 {t.keepPage}</p>

          <button
            onClick={() => {
              setOrderSubmitted(false);
              setOrderId(null);
              setOrderStatus('pending');
              setOrderReady(false);
              setOrderNotes('');
            }}
            className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            {t.newOrder}
          </button>
        </div>
      </div>
    );
  }

  // ─── How to Order Modal ───────────────────────────────────
  const HowToModal = () => showHowTo ? (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHowTo(false)}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-600" />
            {t.howToOrder}
          </h2>
          <button onClick={() => setShowHowTo(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <ol className="space-y-3">
          {[t.howToOrderStep1, t.howToOrderStep2, t.howToOrderStep3, t.howToOrderStep4, t.howToOrderStep5, t.howToOrderStep6].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
              <span className="text-sm text-gray-700 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={() => setShowHowTo(false)}
          className="w-full mt-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
        >
          {t.close}
        </button>
      </div>
    </div>
  ) : null;

  // ─── Category list for a section ──────────────────────────
  const renderCategoryList = (cats: MenuCategory[], isFood: boolean) => (
    <div className="space-y-3">
      {cats.map(cat => {
        const itemCount = getCategoryItemCount(cat.id, isFood);
        if (itemCount === 0) return null;
        const highlights = getCategoryHighlights(cat.id, isFood);
        return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left hover:shadow-md hover:border-emerald-200 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900">{cat.name}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{itemCount} {itemCount === 1 ? t.item : t.items}</p>
                {highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {highlights.slice(0, 3).map(h => (
                      <span key={h.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {h.name}
                      </span>
                    ))}
                    {highlights.length > 3 && (
                      <span className="text-xs text-gray-400">+{highlights.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="ml-3 w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-emerald-600 rotate-180" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ─── Main render ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <HowToModal />

      {/* ===== SECTIONS PAGE (no section or category selected) ===== */}
      {!selectedCategory && !selectedSection ? (
        <div className="min-h-screen">
          {/* Hero Header */}
          <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white pt-10 pb-10 px-6">
            {/* Language selector */}
            <div className="flex justify-end mb-4 gap-1">
              {(Object.keys(LANG_LABELS) as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition ${
                    lang === l ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center text-center">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.name} className="w-24 h-24 rounded-2xl object-cover shadow-lg border-2 border-white/20 mb-4" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <Coffee className="w-10 h-10 text-white/60" />
                </div>
              )}
              <h1 className="text-lg font-semibold text-white/90 tracking-wide">{club.name}</h1>
              {mesa && (
                <p className="text-sm text-white/50 mt-1">{mesaLabel}</p>
              )}
              <div className="mt-6">
                <h2 className="text-4xl font-black tracking-tight">{t.menu}</h2>
                <div className="w-12 h-1 bg-emerald-500 rounded-full mx-auto mt-2" />
              </div>
            </div>

            {/* How to order link */}
            <button
              onClick={() => setShowHowTo(true)}
              className="mt-5 mx-auto flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition text-sm font-medium"
            >
              <HelpCircle className="w-4 h-4" />
              {t.howToOrder}
            </button>
          </div>

          {/* Drinks & Food sections */}
          <div className="p-4 pb-28 space-y-4">
            {categories.length === 0 ? (
              <div className="text-center py-16">
                <Coffee className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">{t.noMenu}</p>
              </div>
            ) : (
              <>
                {/* Drinks section */}
                {drinkCategories.length > 0 && (
                  <button
                    onClick={() => {
                      if (drinkCategories.length === 1) {
                        setSelectedCategory(drinkCategories[0].id);
                      } else {
                        setSelectedSection('drinks');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl shadow-sm border border-blue-100 p-6 text-left hover:shadow-md hover:border-blue-200 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Wine className="w-7 h-7 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{t.drinks}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {drinkCategories.length} {drinkCategories.length === 1 ? 'categoria' : 'categorias'}
                        </p>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-blue-400 rotate-180 flex-shrink-0" />
                    </div>
                  </button>
                )}

                {/* Food section */}
                {foodCategories.length > 0 && (
                  <button
                    onClick={() => {
                      if (foodCategories.length === 1) {
                        setSelectedCategory(foodCategories[0].id);
                      } else {
                        setSelectedSection('food');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl shadow-sm border border-orange-100 p-6 text-left hover:shadow-md hover:border-orange-200 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed className="w-7 h-7 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{t.food}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {foodCategories.length} {foodCategories.length === 1 ? 'categoria' : 'categorias'}
                        </p>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-orange-400 rotate-180 flex-shrink-0" />
                    </div>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

      ) : !selectedCategory && selectedSection ? (
        /* ===== CATEGORY LIST for a section ===== */
        <div className="min-h-screen">
          <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 px-3 py-3">
              <button onClick={() => setSelectedSection(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedSection === 'drinks'
                  ? <Wine className="w-6 h-6 text-blue-600" />
                  : <UtensilsCrossed className="w-6 h-6 text-orange-600" />}
                <h1 className="font-bold text-gray-900 text-lg">{selectedSection === 'drinks' ? t.drinks : t.food}</h1>
              </div>
              {totalItems > 0 && (
                <button onClick={() => setShowCart(true)} className="relative p-2.5 bg-emerald-600 text-white rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">{totalItems}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 pb-28">
            {renderCategoryList(selectedSection === 'drinks' ? drinkCategories : foodCategories, selectedSection === 'food')}
          </div>
        </div>

      ) : (
        /* ===== ITEMS PAGE (category selected) ===== */
        <>
          <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  // Go back to section if there are multiple categories, otherwise go to main
                  if (!selectedSection) {
                    // determine which section this category belongs to
                    const isFood = availableItems.some(it => it.category_id === selectedCategory && it.is_food);
                    const isDrink = availableItems.some(it => it.category_id === selectedCategory && !it.is_food);
                    if (isFood && foodCategories.length > 1) setSelectedSection('food');
                    else if (isDrink && drinkCategories.length > 1) setSelectedSection('drinks');
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {club.logo_url && (
                  <img src={club.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-gray-900 truncate">{selectedCategoryName}</h1>
                  <p className="text-xs text-gray-400">{club.name}{mesa ? ` · ${mesaLabel}` : ''}</p>
                </div>
              </div>
              {totalItems > 0 && (
                <button onClick={() => setShowCart(true)} className="relative p-2.5 bg-emerald-600 text-white rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">{totalItems}</span>
                </button>
              )}
            </div>

            {/* Category quick-switch pills */}
            <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {(selectedSection === 'food' ? foodCategories : selectedSection === 'drinks' ? drinkCategories : categories).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3 pb-28">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <Coffee className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">{t.noItems}</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const qty = getCartQuantity(item.id);
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-4 transition-all ${
                      qty > 0
                        ? 'border-emerald-300 ring-1 ring-emerald-100 shadow-sm'
                        : item.is_highlighted
                        ? 'border-amber-200 bg-amber-50/30 shadow-sm'
                        : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className="flex gap-3">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                              {item.name}
                              {item.is_highlighted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                              {item.is_food && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-semibold">
                                  <ChefHat className="w-3 h-3" />
                                </span>
                              )}
                            </h3>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                            )}
                            {item.is_food && item.kitchen_slot1_start && item.kitchen_slot1_end && (
                              <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {item.kitchen_slot1_start.slice(0, 5)}–{item.kitchen_slot1_end.slice(0, 5)}
                                {item.kitchen_slot2_start && item.kitchen_slot2_end && (
                                  <> · {item.kitchen_slot2_start.slice(0, 5)}–{item.kitchen_slot2_end.slice(0, 5)}</>
                                )}
                              </p>
                            )}
                          </div>
                          <span className="font-bold text-emerald-700 text-lg whitespace-nowrap">
                            {item.price.toFixed(2)}€
                          </span>
                        </div>

                        <div className="flex items-center justify-end mt-3">
                          {qty > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-xl active:bg-red-100 transition"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-bold text-gray-900 w-8 text-center text-lg">{qty}</span>
                              <button
                                onClick={() => addToCart(item)}
                                className="w-9 h-9 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl active:bg-emerald-100 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold active:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              {t.add}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-emerald-600 text-white rounded-2xl py-4 px-6 font-semibold shadow-lg active:bg-emerald-700 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>{t.viewOrder} ({totalItems} {totalItems === 1 ? t.item : t.items})</span>
            </div>
            <span className="text-lg font-bold">{totalPriceWithDiscount.toFixed(2)}€</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                {t.yourOrder}
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {cart.map(c => (
                <div key={c.menuItem.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(c.menuItem.id)} className="p-1 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition">
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="font-bold text-gray-900 w-5 text-center">{c.quantity}</span>
                    <button onClick={() => addToCart(c.menuItem)} className="p-1 bg-white border border-gray-200 rounded-lg hover:bg-emerald-50 transition">
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm flex items-center gap-1">
                      {c.menuItem.is_food ? <ChefHat className="w-3.5 h-3.5 text-orange-500" /> : <Coffee className="w-3.5 h-3.5 text-blue-500" />}
                      {c.menuItem.name}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{(c.quantity * c.menuItem.price).toFixed(2)}€</span>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {mesa === 'Balcão' ? `🏪 ${t.counter}` : `${t.table} *`}
                </label>
                <input
                  type="text"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  placeholder={t.tableNumber}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  disabled={!!tableNumber}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.name} *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.yourName}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    !customerName.trim() ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {t.phone}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      phoneLookupResult?.found ? 'border-green-400 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                  {lookingUpPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>

                {phoneLookupResult?.found && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{phoneLookupResult.name}</span>
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">{phoneLookupResult.source}</div>
                    {phoneLookupResult.discount > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-sm font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md w-fit">
                        🏷️ {t.memberDiscount}: {phoneLookupResult.discount}%
                      </div>
                    )}
                  </div>
                )}
                {phoneLookupResult && !phoneLookupResult.found && customerPhone.replace(/\s+/g, '').length >= 6 && (
                  <p className="text-xs text-gray-500 mt-1">{t.noAccountFound}</p>
                )}
                {!phoneLookupResult && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    🏷️ {t.phoneDiscount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.notes}</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className={`p-3 rounded-xl ${discountPercent > 0 ? 'bg-emerald-100 border border-emerald-300' : 'bg-emerald-50'}`}>
                {discountPercent > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{t.subtotal}</span>
                      <span className="line-through">{totalPrice.toFixed(2)}€</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-emerald-600">
                      <span>🏷️ {t.memberDiscount} ({discountPercent}%)</span>
                      <span>-{(totalPrice - totalPriceWithDiscount).toFixed(2)}€</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                      <span className="font-semibold text-gray-700">{t.total}</span>
                      <span className="text-xl font-bold text-emerald-700">{totalPriceWithDiscount.toFixed(2)}€</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">{t.total}</span>
                    <span className="text-xl font-bold text-emerald-700">{totalPrice.toFixed(2)}€</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !mesa.trim() || !customerName.trim() || cart.length === 0}
                className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.sending}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {t.sendOrder}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
