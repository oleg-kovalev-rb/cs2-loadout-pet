# typed: strict

module Options
  class ItemSortOption < T::Enum
    extend T::Sig

    enums do
      ChangeAmountDesc = new("change_24h_amount_desc")
      ChangeAmountAsc = new("change_24h_amount_asc")
      ChangePercentDesc = new("change_24h_percent_desc")
      ChangePercentAsc = new("change_24h_percent_asc")
      ChangeDesc = new("change_24h_desc")
      PriceDesc = new("price_desc")
      PriceAsc = new("price_asc")
      NameAsc = new("name_asc")
    end

    sig { params(scope: ActiveRecord::Relation).returns(ActiveRecord::Relation) }
    def apply(scope)
      case self
      when ChangeAmountDesc then magnitude_order(scope, amount_magnitude_arel, :desc)
      when ChangeAmountAsc then magnitude_order(scope, amount_magnitude_arel, :asc)
      when ChangePercentDesc, ChangeDesc then magnitude_order(scope, percent_magnitude_arel, :desc)
      when ChangePercentAsc then magnitude_order(scope, percent_magnitude_arel, :asc)
      when PriceDesc then scope.order(current_price_cents: :desc)
      when PriceAsc then scope.order(current_price_cents: :asc)
      when NameAsc then scope.order(Arel.sql("metadata->>'item_name' ASC"))
      else T.absurd(self)
      end
    end

    private

    sig do
      params(scope: ActiveRecord::Relation, expression: Arel::Nodes::SqlLiteral, direction: Symbol)
        .returns(ActiveRecord::Relation)
    end
    def magnitude_order(scope, expression, direction)
      ordered = direction == :desc ? expression.desc : expression.asc
      scope.order(ordered, :market_hash_name)
    end

    sig { returns(Arel::Nodes::SqlLiteral) }
    def amount_magnitude_arel
      Arel.sql("ABS(COALESCE(change_24h_cents, 0))")
    end

    # Mirrors PriceChangePercent's `change / (current - change) * 100`
    # calculation so the ordering matches the percentage the serializer
    # renders. Missing values fall back to zero, the same way the serializers
    # render a nil change.
    sig { returns(Arel::Nodes::SqlLiteral) }
    def percent_magnitude_arel
      Arel.sql(
        "COALESCE(ABS(ROUND((COALESCE(change_24h_cents, 0)::numeric / " \
        "NULLIF(current_price_cents - COALESCE(change_24h_cents, 0), 0)) * 100, 2)), 0)"
      )
    end
  end
end
