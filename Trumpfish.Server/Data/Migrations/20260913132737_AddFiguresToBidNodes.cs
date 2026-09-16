using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFiguresToBidNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FiguresJson",
                table: "BidNodes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FiguresJson",
                table: "BidNodes");
        }
    }
}
