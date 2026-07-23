import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_models.dart';
import '../models/paged_response.dart';
import '../../features/chat/domain/chat_models.dart';
import '../../features/supply_offers/data/models/supply_offer_models.dart';
import 'mobile_repository.dart';

final homeSummaryProvider = FutureProvider.autoDispose<HomeSummary>((ref) => ref.watch(mobileRepositoryProvider).homeSummary());
final productSearchProvider = StateProvider.autoDispose<String>((ref) => '');
final productsProvider = FutureProvider.autoDispose<PagedResponse<Product>>((ref) {
  final search = ref.watch(productSearchProvider);
  return ref.watch(mobileRepositoryProvider).products(search: search);
});
final productDetailProvider = FutureProvider.autoDispose.family<Product, int>((ref, id) => ref.watch(mobileRepositoryProvider).product(id));
final orderFilterProvider = StateProvider.autoDispose<String?>((ref) => null);
final ordersProvider = FutureProvider.autoDispose<PagedResponse<OrderSummary>>((ref) => ref.watch(mobileRepositoryProvider).orders(status: ref.watch(orderFilterProvider)));
final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, int>((ref, id) => ref.watch(mobileRepositoryProvider).order(id));
final invoiceFilterProvider = StateProvider.autoDispose<String?>((ref) => null);
final invoicesProvider = FutureProvider.autoDispose<PagedResponse<InvoiceSummary>>((ref) => ref.watch(mobileRepositoryProvider).invoices(status: ref.watch(invoiceFilterProvider)));
final invoiceDetailProvider = FutureProvider.autoDispose.family<InvoiceDetail, int>((ref, id) => ref.watch(mobileRepositoryProvider).invoice(id));
final shipmentFilterProvider = StateProvider.autoDispose<String?>((ref) => null);
final shipmentsProvider = FutureProvider.autoDispose<PagedResponse<ShipmentSummary>>((ref) => ref.watch(mobileRepositoryProvider).shipments(status: ref.watch(shipmentFilterProvider)));
final shipmentDetailProvider = FutureProvider.autoDispose.family<ShipmentDetail, int>((ref, id) => ref.watch(mobileRepositoryProvider).shipment(id));
final chatMessagesProvider = FutureProvider.autoDispose<List<ChatMessage>>((ref) => ref.watch(mobileRepositoryProvider).chatMessages());
final chatUnreadCountProvider = FutureProvider.autoDispose<int>((ref) => ref.watch(mobileRepositoryProvider).chatUnreadCount());
final supplyOffersProvider = FutureProvider.autoDispose<PagedResponse<SupplyOffer>>((ref) => ref.watch(mobileRepositoryProvider).supplyOffers());
final supplyOfferDetailProvider = FutureProvider.autoDispose.family<SupplyOffer, int>((ref, id) => ref.watch(mobileRepositoryProvider).supplyOffer(id));
