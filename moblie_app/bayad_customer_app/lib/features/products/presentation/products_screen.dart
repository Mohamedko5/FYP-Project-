import 'package:flutter/material.dart';
import 'package:bayad_customer_app/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/bayad_design_system.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../cart/presentation/cart_controller.dart';

class ProductsScreen extends ConsumerWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(productsProvider);
    final l10n = AppLocalizations.of(context);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: l10n.products,
      currentIndex: 1,
      actions: [
        IconButton(
          onPressed: () => context.goNamed(RouteNames.cart),
          icon: const Icon(Icons.shopping_cart_outlined),
        ),
      ],
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
            child: BayadSearchField(
              hintText: l10n.searchProducts,
              onChanged: (value) =>
                  ref.read(productSearchProvider.notifier).state = value,
            ),
          ),
          Expanded(
            child: products.when(
              loading: () => LoadingView(message: l10n.loadingProducts),
              error: (error, _) => ErrorView(
                message: 'Unable to load Products. Please try again.',
                retryLabel: 'Retry',
                onRetry: () => ref.invalidate(productsProvider),
              ),
              data: (page) => page.results.isEmpty
                  ? const EmptyView(message: 'No Products found.')
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.refresh(productsProvider.future),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final bottomInset = MediaQuery.paddingOf(
                            context,
                          ).bottom;
                          final columns = _productGridColumns(
                            constraints.maxWidth,
                          );
                          final spacing = columns == 1 ? 12.0 : 14.0;
                          final horizontalPadding = 16.0;
                          final cardWidth =
                              (constraints.maxWidth -
                                  (horizontalPadding * 2) -
                                  (spacing * (columns - 1))) /
                              columns;
                          final cardHeight = _productCardHeight(
                            cardWidth,
                            isArabic: isArabic,
                          );
                          return GridView.builder(
                            padding: EdgeInsets.fromLTRB(
                              horizontalPadding,
                              0,
                              horizontalPadding,
                              92 + bottomInset,
                            ),
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: columns,
                                  mainAxisSpacing: spacing,
                                  crossAxisSpacing: spacing,
                                  mainAxisExtent: cardHeight,
                                ),
                            itemCount: page.results.length,
                            itemBuilder: (context, index) {
                              final product = page.results[index];
                              return ProductCard(
                                product: product,
                                isArabic: isArabic,
                                addToCartLabel: l10n.addToCart,
                                availableLabel: l10n.available,
                                unavailableLabel: l10n.unavailable,
                                onDetails: () => context.goNamed(
                                  RouteNames.productDetail,
                                  pathParameters: {'id': '${product.id}'},
                                ),
                                onAdd: () {
                                  final unit = product.units.firstWhere(
                                    (unit) => unit.isAvailable,
                                    orElse: () => product.units.first,
                                  );
                                  ref
                                      .read(cartControllerProvider.notifier)
                                      .add(product, unit, 1);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(l10n.addedToCart)),
                                  );
                                },
                              );
                            },
                          );
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

int _productGridColumns(double width) {
  if (width < 340) return 1;
  if (width >= 900) return 4;
  if (width >= 620) return 3;
  return 2;
}

double _productCardHeight(double cardWidth, {required bool isArabic}) {
  final baseHeight = cardWidth * 1.66 + (isArabic ? 18 : 10);
  return baseHeight.clamp(292.0, 340.0);
}

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});
  final int productId;
  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int? _unitId;
  final _qty = TextEditingController(text: '1');

  @override
  void dispose() {
    _qty.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = ref.watch(productDetailProvider(widget.productId));
    final l10n = AppLocalizations.of(context);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: 'Product Details',
      currentIndex: 1,
      actions: [
        IconButton(
          onPressed: () => context.goNamed(RouteNames.cart),
          icon: const Icon(Icons.shopping_cart_outlined),
        ),
      ],
      child: product.when(
        loading: () => const LoadingView(message: 'Loading Product...'),
        error: (error, _) => ErrorView(
          message: 'Unable to load Product. Please try again.',
          retryLabel: 'Retry',
          onRetry: () =>
              ref.invalidate(productDetailProvider(widget.productId)),
        ),
        data: (item) {
          final selected = item.units
              .where(
                (unit) => unit.id == (_unitId ?? item.units.firstOrNull?.id),
              )
              .firstOrNull;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
            children: [
              BayadCard(
                padding: EdgeInsets.zero,
                child: Padding(
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 220,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEAF2E5),
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.grass,
                            size: 72,
                            color: Color(0xFF4D6B4A),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        item.localizedName(isArabic),
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 6),
                      Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(item.code),
                      ),
                      const SizedBox(height: 12),
                      Text(item.description),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<int>(
                        initialValue: selected?.id,
                        decoration: const InputDecoration(labelText: 'Unit'),
                        items: [
                          for (final unit in item.units)
                            DropdownMenuItem(
                              value: unit.id,
                              child: Text(
                                '${unit.unit} • ${formatMoney(unit.sellingPrice)}',
                              ),
                            ),
                        ],
                        onChanged: (value) => setState(() => _unitId = value),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _qty,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Quantity',
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: selected == null || !selected.isAvailable
                            ? null
                            : () {
                                final qty = double.tryParse(_qty.text) ?? 0;
                                if (qty <= 0) return;
                                ref
                                    .read(cartControllerProvider.notifier)
                                    .add(item, selected, qty);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(l10n.addedToCart)),
                                );
                              },
                        child: Text(l10n.addToCart),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
