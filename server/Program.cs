using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;
using OpenAI;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add HttpClient for OpenAI API calls
builder.Services.AddHttpClient();

// Add OpenAI client
builder.Services.AddSingleton<OpenAIClient>(provider =>
{
    var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? 
                provider.GetRequiredService<IConfiguration>()["OpenAI:ApiKey"];
    
    if (string.IsNullOrEmpty(apiKey))
    {
        throw new InvalidOperationException("OpenAI API key not configured");
    }
    
    return new OpenAIClient(apiKey);
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp");

// Enable WebSockets
app.UseWebSockets();

// Chat API endpoint
app.MapPost("/api/chat", async (HttpContext context) =>
{
    try
    {
        using var reader = new StreamReader(context.Request.Body);
        var requestBody = await reader.ReadToEndAsync();
        
        if (string.IsNullOrEmpty(requestBody))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Request body is required");
            return;
        }

        var requestJson = JsonDocument.Parse(requestBody);
        
        var openAiClient = context.RequestServices.GetRequiredService<OpenAIClient>();
        var messages = requestJson.RootElement.GetProperty("messages");
        
        if (messages.ValueKind != JsonValueKind.Array || messages.GetArrayLength() == 0)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Messages array is required and cannot be empty");
            return;
        }

        // Create OpenAI request using the original approach but with the client
        var model = requestJson.RootElement.TryGetProperty("model", out var modelProp) ? 
                   modelProp.GetString() : app.Configuration["OpenAI:ChatModel"] ?? "gpt-4o";
        
        var maxTokens = requestJson.RootElement.TryGetProperty("max_tokens", out var maxTokensProp) ? 
                       maxTokensProp.GetInt32() : 1000;

        var openAiRequest = new
        {
            model = model,
            messages = messages,
            stream = true,
            max_tokens = maxTokens
        };

        // Use the OpenAI client's underlying HTTP client for streaming
        using var httpClient = new HttpClient();
        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? 
                    app.Configuration["OpenAI:ApiKey"];
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        
        var content = new StringContent(JsonSerializer.Serialize(openAiRequest), 
                                      Encoding.UTF8, "application/json");

        var response = await httpClient.PostAsync("https://api.openai.com/v1/chat/completions", content);
        
        context.Response.StatusCode = (int)response.StatusCode;
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers["Cache-Control"] = "no-cache";
        context.Response.Headers["Connection"] = "keep-alive";

        if (response.IsSuccessStatusCode)
        {
            using var stream = await response.Content.ReadAsStreamAsync();
            await stream.CopyToAsync(context.Response.Body);
        }
        else
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            await context.Response.WriteAsync($"data: {errorContent}\n\n");
        }
    }
    catch (Exception ex)
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync($"data: {{\"error\": \"Internal server error: {ex.Message}\"}}\n\n");
    }
});

// Text-to-Speech endpoint
app.MapPost("/api/tts", async (HttpContext context) =>
{
    try
    {
        var openAiClient = context.RequestServices.GetRequiredService<OpenAIClient>();

        using var reader = new StreamReader(context.Request.Body);
        var requestBody = await reader.ReadToEndAsync();
        
        var requestJson = JsonDocument.Parse(requestBody);
        var text = requestJson.RootElement.GetProperty("text").GetString();
        var voice = requestJson.RootElement.TryGetProperty("voice", out var voiceProp) ? 
                   voiceProp.GetString() : "alloy";

        if (string.IsNullOrEmpty(text))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Text is required");
            return;
        }

        if (text.Length > 4096)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Text exceeds maximum length of 4096 characters");
            return;
        }

        var model = app.Configuration["OpenAI:TtsModel"] ?? "tts-1";
        
        var ttsRequest = new
        {
            model = model,
            input = text,
            voice = voice
        };

        // Use the OpenAI client's underlying HTTP client
        using var httpClient = new HttpClient();
        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? 
                    app.Configuration["OpenAI:ApiKey"];
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        
        var content = new StringContent(JsonSerializer.Serialize(ttsRequest), 
                                      Encoding.UTF8, "application/json");

        var response = await httpClient.PostAsync("https://api.openai.com/v1/audio/speech", content);
        
        context.Response.StatusCode = (int)response.StatusCode;
        context.Response.ContentType = "audio/mpeg";

        if (response.IsSuccessStatusCode)
        {
            using var stream = await response.Content.ReadAsStreamAsync();
            await stream.CopyToAsync(context.Response.Body);
        }
        else
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            await context.Response.WriteAsync(errorContent);
        }
    }
    catch (Exception ex)
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync($"Error: {ex.Message}");
    }
});

// Realtime WebSocket endpoint
app.Map("/api/realtime", async (HttpContext context) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        Console.WriteLine("WebSocket connection request received");
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        Console.WriteLine("WebSocket connection accepted");
        await HandleRealtimeConnection(webSocket, app.Configuration, app.Services);
    }
    else
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("WebSocket connection required");
    }
});

async Task HandleRealtimeConnection(WebSocket webSocket, IConfiguration configuration, IServiceProvider serviceProvider)
{
    var openAiClient = serviceProvider.GetRequiredService<OpenAIClient>();
    var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? 
                configuration["OpenAI:ApiKey"];
    
    if (string.IsNullOrEmpty(apiKey))
    {
        await webSocket.CloseAsync(WebSocketCloseStatus.InternalServerError, 
                                 "OpenAI API key not configured", CancellationToken.None);
        return;
    }

    var buffer = new byte[1024 * 4];
    var openAiWebSocket = new ClientWebSocket();
    
    try
    {
        // Connect to OpenAI Realtime API
        openAiWebSocket.Options.SetRequestHeader("Authorization", $"Bearer {apiKey}");
        var model = configuration["OpenAI:RealtimeModel"] ?? "gpt-realtime-2025-08-28";

        var openAiUri = new Uri($"wss://api.openai.com/v1/realtime?model={model}");
        
        Console.WriteLine($"Attempting to connect to OpenAI Realtime API: {openAiUri}");
        await openAiWebSocket.ConnectAsync(openAiUri, CancellationToken.None);
        Console.WriteLine("Successfully connected to OpenAI Realtime API");

        // Send initial session configuration message
        var sessionConfig = new
        {
            type = "session.update",
            session = new
            {
                type = "realtime",
                model = model,
                // Enable audio output only (text is not supported with audio)
                output_modalities = new[] { "audio" },
                audio = new
                {
                    input = new
                    {
                        format = new
                        {
                            type = "audio/pcm",
                            rate = 24000
                        },
                        turn_detection = new
                        {
                            type = "semantic_vad"
                        }
                    },
                    output = new
                    {
                        format = new
                        {
                            type = "audio/pcm",
                            rate = 24000
                        },
                        voice = "alloy"
                    }
                },
                instructions = "You are a helpful AI assistant. Respond to the user's voice messages with speech only. Keep responses concise and natural."
            }
        };

        var configJson = JsonSerializer.Serialize(sessionConfig);
        var configBytes = Encoding.UTF8.GetBytes(configJson);
        
        Console.WriteLine($"Sending session configuration: {configJson}");
        await openAiWebSocket.SendAsync(new ArraySegment<byte>(configBytes), 
                                      WebSocketMessageType.Text, true, CancellationToken.None);
        Console.WriteLine("Session configuration sent successfully");

        // Start bidirectional relay
        var clientToOpenAi = RelayMessages(webSocket, openAiWebSocket, "Client->OpenAI");
        var openAiToClient = RelayMessages(openAiWebSocket, webSocket, "OpenAI->Client");

        // Wait for either relay to complete (which means connection is closing)
        var completedTask = await Task.WhenAny(clientToOpenAi, openAiToClient);
        
        // Give a moment for the other relay to finish gracefully
        await Task.Delay(100);
        
        // Cancel any remaining operations
        try
        {
            if (!clientToOpenAi.IsCompleted)
            {
                Console.WriteLine("Client->OpenAI relay still running, waiting for completion...");
                await Task.WhenAny(clientToOpenAi, Task.Delay(2000)); // Wait up to 2 seconds
            }
            if (!openAiToClient.IsCompleted)
            {
                Console.WriteLine("OpenAI->Client relay still running, waiting for completion...");
                await Task.WhenAny(openAiToClient, Task.Delay(2000)); // Wait up to 2 seconds
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during relay cleanup: {ex.Message}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WebSocket error: {ex.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
    }
    finally
    {
        if (openAiWebSocket.State == WebSocketState.Open)
            await openAiWebSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
        
        if (webSocket.State == WebSocketState.Open)
            await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
    }
}

async Task RelayMessages(WebSocket source, WebSocket destination, string direction)
{
    var buffer = new byte[1024 * 4];
    
    try
    {
        Console.WriteLine($"Starting {direction} relay");
        while (source.State == WebSocketState.Open && destination.State == WebSocketState.Open)
        {
            var result = await source.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            
            if (result.MessageType == WebSocketMessageType.Close)
            {
                Console.WriteLine($"{direction} relay: Received close message, closing destination");
                if (destination.State == WebSocketState.Open)
                {
                    await destination.CloseAsync(WebSocketCloseStatus.NormalClosure, "Relay closing", CancellationToken.None);
                }
                break;
            }
            
            // Log message content for debugging (first few messages)
            if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
            {
                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Console.WriteLine($"{direction} relay: Received text message: {message.Substring(0, Math.Min(message.Length, 200))}");
                
                // Check for error messages from OpenAI
                if (message.Contains("\"type\":\"error\""))
                {
                    Console.WriteLine($"{direction} relay: OpenAI API error detected: {message}");
                }
                
                // Log audio buffer append messages
                if (message.Contains("\"type\":\"input_audio_buffer.append\""))
                {
                    Console.WriteLine($"{direction} relay: Audio buffer append message received");
                }
            }
            else if (result.MessageType == WebSocketMessageType.Binary)
            {
                Console.WriteLine($"{direction} relay: Received binary message ({result.Count} bytes)");
            }
            
            // Only send if destination is still open
            if (destination.State == WebSocketState.Open)
            {
                try
                {
                    await destination.SendAsync(new ArraySegment<byte>(buffer, 0, result.Count), 
                                              result.MessageType, result.EndOfMessage, CancellationToken.None);
                }
                catch (Exception sendEx)
                {
                    Console.WriteLine($"{direction} relay: Failed to send message: {sendEx.Message}");
                    break;
                }
            }
            else
            {
                Console.WriteLine($"{direction} relay: Destination WebSocket is not open, stopping relay");
                break;
            }
        }
        Console.WriteLine($"{direction} relay ended");
    }
    catch (WebSocketException wsEx)
    {
        Console.WriteLine($"{direction} relay WebSocket error: {wsEx.Message} (ErrorCode: {wsEx.WebSocketErrorCode})");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"{direction} relay error: {ex.Message}");
    }
}

app.Run();
