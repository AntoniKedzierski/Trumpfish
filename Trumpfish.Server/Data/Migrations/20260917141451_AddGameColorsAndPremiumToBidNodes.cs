using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGameColorsAndPremiumToBidNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InputBidColor",
                table: "BidNodes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OutputGameColor",
                table: "BidNodes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TryPremiumContract",
                table: "BidNodes",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InputBidColor",
                table: "BidNodes");

            migrationBuilder.DropColumn(
                name: "OutputGameColor",
                table: "BidNodes");

            migrationBuilder.DropColumn(
                name: "TryPremiumContract",
                table: "BidNodes");
        }
    }
}
